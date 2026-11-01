import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { Resend } from "resend";

// Daily logging reminder, run by Vercel Cron (see vercel.json). Emails each
// active worker who hasn't logged hours for their reminder threshold — the
// same "reminderEnabled" / "reminderDays" settings as the in-app banner.
// Team admins get one email listing workers who've gone a week without an
// entry. Stateless: it sends on the day a threshold is reached and then once
// a week while the gap continues, so nobody gets a daily email.

const FROM     = process.env.RESEND_FROM_EMAIL ?? "notifications@splitshift.com.au";
const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.splitshift.com.au";
const TIMEZONE = process.env.REMINDER_TIMEZONE ?? "Australia/Sydney";
const REPEAT_DAYS = 7;
const ADMIN_ALERT_DAYS = 7;

// Sends on the day `days` reaches `threshold`, then every REPEAT_DAYS after.
function isDue(days: number, threshold: number): boolean {
  return days >= threshold && (days - threshold) % REPEAT_DAYS === 0;
}

// YYYY-MM-DD in the team's timezone (the cron runs in UTC).
function localDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000);
}

function buildHtml(name: string, days: number, lastDate: string | null): string {
  const gap = lastDate
    ? `It's been <strong style="color:#18181b;">${days} day${days === 1 ? "" : "s"}</strong> since your last entry.`
    : `You haven't logged any hours yet.`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Log your hours</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <!-- Header -->
        <tr><td align="center" style="padding-bottom:24px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:10px;vertical-align:middle;">
              <div style="width:36px;height:36px;background-color:#d97706;border-radius:8px;text-align:center;line-height:36px;">
                <span style="color:#ffffff;font-size:20px;">&#128188;</span>
              </div>
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:20px;font-weight:700;color:#18181b;letter-spacing:-0.3px;">SplitShift</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- Card -->
        <tr><td style="background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;padding:40px 40px 32px;">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;letter-spacing:-0.3px;">
            Don't forget to log your hours
          </h1>
          <p style="margin:0 0 24px;font-size:15px;color:#71717a;line-height:1.6;">
            Hi ${name}, ${gap} Log your shifts so your timesheet and pay stay up to date.
          </p>

          <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr>
            <td style="background-color:#d97706;border-radius:8px;">
              <a href="${APP_URL}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                Log my hours
              </a>
            </td>
          </tr></table>

          <p style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.6;">
            You can change or turn off these reminders in <strong>SplitShift</strong> under Settings.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="padding-top:24px;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;">
            &copy; SplitShift &mdash; splitshift.com.au
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

interface InactiveWorker { name: string; days: number; lastDate: string | null }

function buildAdminHtml(workers: InactiveWorker[]): string {
  const rows = workers.map((w, i) => `
            <tr style="background:${i % 2 === 0 ? "#f8f9fa" : "#ffffff"};">
              <td style="padding:10px 16px;font-size:13px;color:#18181b;">${escapeHtml(w.name)}</td>
              <td style="padding:10px 16px;font-size:13px;color:#71717a;">${w.lastDate ? `${w.days} days (last ${w.lastDate})` : "No entries yet"}</td>
            </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Workers without logged hours</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <!-- Header -->
        <tr><td align="center" style="padding-bottom:24px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:10px;vertical-align:middle;">
              <div style="width:36px;height:36px;background-color:#d97706;border-radius:8px;text-align:center;line-height:36px;">
                <span style="color:#ffffff;font-size:20px;">&#128188;</span>
              </div>
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:20px;font-weight:700;color:#18181b;letter-spacing:-0.3px;">SplitShift</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- Card -->
        <tr><td style="background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;padding:40px 40px 32px;">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;letter-spacing:-0.3px;">
            No hours logged for a week
          </h1>
          <p style="margin:0 0 24px;font-size:15px;color:#71717a;line-height:1.6;">
            ${workers.length === 1 ? "This worker hasn't" : "These workers haven't"} logged any hours in the last ${ADMIN_ALERT_DAYS} days or more.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;margin-bottom:24px;">${rows}
          </table>

          <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr>
            <td style="background-color:#d97706;border-radius:8px;">
              <a href="${APP_URL}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                Open SplitShift
              </a>
            </td>
          </tr></table>
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="padding-top:24px;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;">
            &copy; SplitShift &mdash; splitshift.com.au
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ ok: false, error: "RESEND_API_KEY not set" });
  const resend = new Resend(process.env.RESEND_API_KEY);
  const admin  = createAdminClient();
  const today  = localDate(new Date());

  // Active workers on a team.
  const { data: workerRows } = await admin
    .from("profiles").select("user_id, name, email, admin_id")
    .eq("role", "user")
    .not("admin_id", "is", null)
    .is("removed_at", null);
  const workers = ((workerRows ?? []) as { user_id: string; name: string | null; email: string | null; admin_id: string }[])
    // Demo accounts have no real inbox — emailing them would only bounce.
    .filter(w => w.email && !w.email.endsWith("@demo.splitshift.com.au"));

  const { data: settingsRows } = await admin
    .from("settings").select("user_id, data")
    .in("user_id", workers.map(w => w.user_id));
  const settingsById = new Map(((settingsRows ?? []) as { user_id: string; data: { reminderEnabled?: boolean; reminderDays?: number } | null }[])
    .map(r => [r.user_id, r.data ?? {}]));

  const sent: string[] = [];
  const failed: string[] = [];
  const inactiveByAdmin = new Map<string, InactiveWorker[]>();

  for (const w of workers) {
    const s = settingsById.get(w.user_id) ?? {};
    const threshold = s.reminderDays ?? 2;

    // Only workers who've accepted their invite — no reminders before sign-up.
    const { data: au } = await admin.auth.admin.getUserById(w.user_id);
    const confirmedAt = au?.user?.confirmed_at ?? au?.user?.email_confirmed_at;
    if (!confirmedAt) continue;

    const { data: last } = await admin
      .from("entries").select("date")
      .eq("user_id", w.user_id).is("deleted_at", null)
      .order("date", { ascending: false }).limit(1).maybeSingle();
    const lastDate = (last as { date: string } | null)?.date ?? null;

    // With no entries yet, count from the day they joined.
    const days = daysBetween(lastDate ?? localDate(new Date(confirmedAt)), today);

    if (isDue(days, ADMIN_ALERT_DAYS)) {
      const list = inactiveByAdmin.get(w.admin_id) ?? [];
      list.push({ name: w.name || w.email!, days, lastDate });
      inactiveByAdmin.set(w.admin_id, list);
    }

    if (s.reminderEnabled === false || !isDue(days, threshold)) continue;

    const name = w.name?.split(" ")[0] || "there";
    const { error } = await resend.emails.send({
      from:    FROM,
      to:      w.email!,
      subject: "[SplitShift] Don't forget to log your hours",
      html:    buildHtml(name, days, lastDate),
    });
    (error ? failed : sent).push(w.email!);
  }

  // One alert per team, sent to each active admin (owner and co-admins)
  // separately so recipients never see each other's addresses.
  let adminSent = 0;
  for (const [adminId, inactive] of inactiveByAdmin) {
    const { data: ap } = await admin
      .from("profiles").select("admin_id, role").eq("user_id", adminId).maybeSingle();
    const a = ap as { admin_id: string | null; role: string } | null;
    const rootId = (a?.role === "admin" && a.admin_id) ? a.admin_id : adminId;

    const { data: adminRows } = await admin
      .from("profiles").select("email")
      .eq("role", "admin")
      .is("removed_at", null)
      .or(`user_id.eq.${rootId},admin_id.eq.${rootId}`);
    const adminEmails = [...new Set(((adminRows ?? []) as { email: string | null }[])
      .map(r => r.email).filter((e): e is string => !!e))];
    if (adminEmails.length === 0) continue;

    const subject = inactive.length === 1
      ? `[SplitShift] ${inactive[0].name} hasn't logged hours for a week`
      : `[SplitShift] ${inactive.length} workers haven't logged hours for a week`;
    const html = buildAdminHtml(inactive);
    const { error } = await resend.batch.send(adminEmails.map(to => ({ from: FROM, to, subject, html })));
    if (error) failed.push(...adminEmails);
    else adminSent += adminEmails.length;
  }

  return NextResponse.json({ ok: true, date: today, sent: sent.length, adminSent, failed });
}
