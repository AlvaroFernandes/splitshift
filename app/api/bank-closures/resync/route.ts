import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { closedWeekBankHours } from "@/lib/historicalProcessing";
import { weekStart } from "@/lib/calculations";
import { getEntries } from "@/services/entries";
import { getInvoices } from "@/services/invoices";
import { getSettings, DEFAULT_SETTINGS } from "@/services/settings";
import { getBankClosures, updateBankClosureHours, type BankClosure } from "@/services/bankClosures";
import { logActivity } from "@/services/audit";

// POST { userId, weekStarts } — after an entry in a closed Hour Bank week is
// edited or deleted, recompute those weeks' banked hours from the entries as
// they are now and update their closures. Without this the Hour Bank keeps
// the figure frozen at closing time while the Weekly Report shows the edit.
//
// Runs server side because bank_closures has no UPDATE policy, and so the
// hours always come from the database, never from the client. Callable by the
// worker themselves or by an admin of their team.
export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => null) as { userId?: unknown; weekStarts?: unknown } | null;
  const uid = typeof body?.userId === "string" ? body.userId : null;
  const weeks = Array.isArray(body?.weekStarts)
    ? [...new Set((body.weekStarts as unknown[]).filter((w): w is string => typeof w === "string" && /^\d{4}-\d{2}-\d{2}$/.test(w)).map(weekStart))]
    : [];
  if (!uid || weeks.length === 0) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles").select("user_id, role, admin_id, name, email").in("user_id", [...new Set([user.id, uid])]);
  type P = { user_id: string; role: string; admin_id: string | null; name: string | null; email: string | null };
  const caller = (profiles as P[] | null)?.find(p => p.user_id === user.id);
  const worker = (profiles as P[] | null)?.find(p => p.user_id === uid);
  if (!caller || !worker) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // The worker themselves, or an admin of the worker's team (the owner, whose
  // admin_id is null, or a co-admin pointing at the same owner).
  const callerRoot = caller.admin_id ?? caller.user_id;
  const allowed = uid === user.id || (caller.role === "admin" && worker.admin_id === callerRoot);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [entries, invoices, closures, settingsRow] = await Promise.all([
    getEntries(admin, uid), getInvoices(admin, uid), getBankClosures(admin, uid), getSettings(admin, uid),
  ]);
  const settings = settingsRow?.settings ?? DEFAULT_SETTINGS;

  const updated: BankClosure[] = [];
  for (const ws of weeks) {
    const c = closures.find(x => x.weekStart === ws);
    if (!c || c.mode !== "bank") continue;
    // A closed week left with no entries is left alone — it may be an empty
    // week charged to a full-time worker by the Sunday cron.
    if (!entries.some(e => weekStart(e.date) === ws)) continue;

    const hours = +closedWeekBankHours(entries, settings, invoices, closures, ws).toFixed(6);
    if (Math.abs(hours - c.hours) < 1e-6) continue;

    const saved = await updateBankClosureHours(admin, c.id, hours);
    if (!saved) return NextResponse.json({ error: "Could not update Hour Bank" }, { status: 500 });
    updated.push(saved);
    await logActivity(admin, worker.admin_id ?? uid, user.id, "bank_closure_recalculated", "worker", uid, {
      workerName: worker.name || worker.email || "", weekStart: ws, from: c.hours, to: hours,
    }).catch(() => {});
  }

  return NextResponse.json({ closures: updated });
}
