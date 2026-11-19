import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { processEntries, weekStart, weekEnd, limitPeriodOf } from "@/lib/calculations";
import { processEntriesWithHistory } from "@/lib/historicalProcessing";
import { getEntries, archiveEntries } from "@/services/entries";
import { getSettings } from "@/services/settings";
import { getInvoices } from "@/services/invoices";
import { getBankClosures, saveBankClosure } from "@/services/bankClosures";
import { logActivity } from "@/services/audit";

// Weekly auto-close, run by Vercel Cron (see vercel.json) in the last minute
// of Sunday, team time. Does for every worker what the "Close week" button
// does: archives each open week that has ended (the current one included,
// since it ends this minute) and freezes its regime in bank_closures — Hour
// Bank weeks book their hours / shortfall, ABN weeks within the TFN limit
// close without an invoice. ABN weeks over the limit still need an invoice,
// so they're left open for the worker. Workers can still close a week early
// from the app; those weeks are already archived and skipped here.
//
// Cron runs in UTC, so it's scheduled at both 12:59 and 13:59 UTC on Sunday
// (23:59 Sydney in daylight saving and in standard time) and only acts on
// the run that lands on Sunday 23:xx local. `?force=1` skips that check;
// `?dry=1` reports what would be closed without changing anything.

const TIMEZONE = process.env.REMINDER_TIMEZONE ?? "Australia/Sydney";

function localParts(d: Date): { date: string; weekday: string; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
      weekday: "short", hour: "2-digit", hourCycle: "h23",
    }).formatToParts(d).map(p => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: parts.weekday, hour: Number(parts.hour) };
}

function nextDay(date: string): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = localParts(new Date());
  const force = request.nextUrl.searchParams.get("force") === "1";
  const dry   = request.nextUrl.searchParams.get("dry") === "1";
  if (!force && !dry && !(now.weekday === "Sun" && now.hour === 23)) {
    return NextResponse.json({ ok: true, skipped: `not Sunday 23:xx in ${TIMEZONE}`, local: now });
  }
  const today = now.date;

  const admin = createAdminClient();
  const { data: workerRows } = await admin
    .from("profiles").select("user_id, name, admin_id")
    .eq("role", "user")
    .not("admin_id", "is", null)
    .is("removed_at", null);
  const workers = (workerRows ?? []) as { user_id: string; name: string | null; admin_id: string }[];

  const closed: { worker: string; week: string; mode: "abn" | "bank" }[] = [];
  const needsInvoice: { worker: string; week: string }[] = [];
  const failed: { worker: string; week: string }[] = [];

  for (const w of workers) {
    const uid = w.user_id;
    const entries = await getEntries(admin, uid);
    const openWeeks = [...new Set(entries.filter(e => !e.archived).map(e => weekStart(e.date)))]
      .filter(ws => weekEnd(ws) <= today)
      .sort();
    if (openWeeks.length === 0) continue;

    const settings = (await getSettings(admin, uid))?.settings;
    if (!settings) continue;
    const isBank = settings.excessMode === "bank";
    const invoices = isBank ? await getInvoices(admin, uid) : [];
    let closures = isBank ? await getBankClosures(admin, uid) : [];
    const tfnRate = parseFloat(settings.tfnRate || "") || undefined;
    const overtime = settings.overtimeThreshold || 12;

    // Oldest first, so a monthly Hour Bank budget sees earlier weeks closed.
    for (const ws of openWeeks) {
      const weekEntries = isBank
        // Same as closeWeek in the app: the week counts as ended, so any
        // shortfall against the TFN limit comes out of the bank.
        ? processEntriesWithHistory(entries, settings, invoices, closures, nextDay(weekEnd(ws)))
            .filter(e => weekStart(e.date) === ws)
        // ABN limits are weekly, so the week's open entries decide it alone.
        : processEntries(
            entries.filter(e => !e.archived && weekStart(e.date) === ws),
            settings.tfnLimit, tfnRate, overtime, "abn",
          );

      if (!isBank && weekEntries.some(e => e.abnPortion > 0)) {
        needsInvoice.push({ worker: uid, week: ws });
        continue;
      }

      const ids = weekEntries.filter(e => !e.archived).map(e => e.id);
      if (ids.length === 0) continue;
      if (dry) { closed.push({ worker: uid, week: ws, mode: isBank ? "bank" : "abn" }); continue; }
      if (!await archiveEntries(admin, ids)) { failed.push({ worker: uid, week: ws }); continue; }

      const closure = await saveBankClosure(admin, {
        userId: uid, weekStart: ws, weekEnd: weekEnd(ws),
        hours: isBank ? weekEntries.reduce((s, e) => s + e.bankHours, 0) : 0,
        mode: isBank ? "bank" : "abn",
        tfnLimit: settings.tfnLimit, tfnRate, overtimeThreshold: overtime,
        limitPeriod: limitPeriodOf(settings),
      });
      if (!closure) { failed.push({ worker: uid, week: ws }); continue; }

      for (const e of entries) if (ids.includes(e.id)) e.archived = true;
      closures = [closure, ...closures.filter(c => c.weekStart !== ws)];
      closed.push({ worker: uid, week: ws, mode: isBank ? "bank" : "abn" });

      await logActivity(admin, w.admin_id, uid, "week_auto_closed", "worker", uid, {
        workerName: w.name ?? "", weekStart: ws, mode: isBank ? "bank" : "abn",
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, dry, date: today, closed: closed.length, needsInvoice, failed, details: closed });
}
