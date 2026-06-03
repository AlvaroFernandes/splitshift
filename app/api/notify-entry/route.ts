import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { Resend } from "resend";

const FROM = process.env.RESEND_FROM_EMAIL ?? "notifications@splitshift.com.au";

function calcHours(start: string, end: string, breakMins: number): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm - breakMins) / 60);
}

function buildHtml(workerName: string, entry: {
  date: string; jobDescription: string; client?: string;
  startTime: string; endTime: string; breakMins: number; hourlyRate: number;
}): string {
  const hours    = calcHours(entry.startTime, entry.endTime, entry.breakMins);
  const earnings = (hours * entry.hourlyRate).toFixed(2);
  const hoursStr = `${Math.floor(hours)}h ${String(Math.round((hours % 1) * 60)).padStart(2, "0")}m`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>New entry logged</title></head>
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
            New entry logged
          </h1>
          <p style="margin:0 0 24px;font-size:15px;color:#71717a;line-height:1.6;">
            <strong style="color:#18181b;">${workerName}</strong> just logged a new work entry.
          </p>

          <!-- Details table -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;margin-bottom:24px;">
            ${[
              ["Date",        entry.date],
              ["Job",         entry.jobDescription + (entry.client ? ` — ${entry.client}` : "")],
              ["Time",        `${entry.startTime} – ${entry.endTime}${entry.breakMins > 0 ? ` (${entry.breakMins}m break)` : ""}`],
              ["Hours",       hoursStr],
              ["Rate",        `$${entry.hourlyRate.toFixed(2)}/h`],
              ["Earnings",    `$${earnings}`],
            ].map(([label, value], i) => `
            <tr style="background:${i % 2 === 0 ? "#f8f9fa" : "#ffffff"};">
              <td style="padding:10px 16px;font-size:13px;color:#71717a;font-weight:500;width:110px;">${label}</td>
              <td style="padding:10px 16px;font-size:13px;color:#18181b;">${value}</td>
            </tr>`).join("")}
          </table>

          <p style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.6;">
            Log in to <strong>SplitShift</strong> to view or edit this entry.
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

export async function POST(request: NextRequest) {
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ ok: false });
  const resend = new Resend(process.env.RESEND_API_KEY);

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  // Only workers trigger notifications
  const { data: profile } = await supabase
    .from("profiles").select("role, admin_id, name").eq("user_id", user.id).maybeSingle();
  const p = profile as { role: string; admin_id: string | null; name: string | null } | null;
  if (!p || p.role !== "user" || !p.admin_id) return NextResponse.json({ ok: false });

  const workerName = p.name || user.email || "A worker";

  // Resolve root admin and get their email
  const admin = createAdminClient();
  const { data: adminProfile } = await admin
    .from("profiles").select("email, admin_id, role").eq("user_id", p.admin_id).maybeSingle();
  const ap = adminProfile as { email: string | null; admin_id: string | null; role: string } | null;

  // Walk up one level if admin is a co-admin
  const rootId   = (ap?.role === "admin" && ap?.admin_id) ? ap.admin_id : p.admin_id;
  const { data: rootProfile } = await admin
    .from("profiles").select("email").eq("user_id", rootId).maybeSingle();
  const adminEmail = (rootProfile as { email: string | null } | null)?.email ?? ap?.email;

  if (!adminEmail) return NextResponse.json({ ok: false });

  const body = await request.json() as {
    date: string; jobDescription: string; client?: string;
    startTime: string; endTime: string; breakMins: number; hourlyRate: number;
  };

  await resend.emails.send({
    from:    FROM,
    to:      adminEmail,
    subject: `[SplitShift] ${workerName} logged a new entry`,
    html:    buildHtml(workerName, body),
  });

  return NextResponse.json({ ok: true });
}
