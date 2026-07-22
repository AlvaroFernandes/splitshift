import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import type { InviteStatus } from "@/types";

// How long a Supabase invite link stays valid before we treat it as expired.
// Should match the project's Auth "Email OTP expiration" setting (default 24h).
const INVITE_EXPIRY_HOURS = Number(process.env.INVITE_EXPIRY_HOURS) || 24;

// Verifies the caller is an authenticated admin and returns their root admin id
// (sub-admins share their parent admin's pool of invited users).
async function requireAdmin(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }) } as const;

  const { data: callerProfile } = await supabase
    .from("profiles").select("role, admin_id")
    .eq("user_id", user.id).maybeSingle();

  const p = callerProfile as { role: string; admin_id: string | null } | null;
  if (p?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  }
  return { rootAdminId: p.admin_id ?? user.id } as const;
}

// Returns invite status for every profile under the given root admin, derived
// from Supabase's own auth.users record (invited_at / confirmed_at).
export async function GET() {
  const supabase = await createServerClient();
  const auth = await requireAdmin(supabase);
  if ("error" in auth) return auth.error;

  const { data: rows } = await supabase
    .from("profiles").select("user_id")
    .eq("admin_id", auth.rootAdminId);

  const userIds = [...new Set((rows ?? []).map(r => (r as { user_id: string }).user_id))];
  const admin = createAdminClient();

  const statuses: Record<string, { status: InviteStatus; invitedAt: string | null }> = {};
  await Promise.all(userIds.map(async id => {
    const { data } = await admin.auth.admin.getUserById(id);
    const au = data?.user;
    if (!au) return;

    const invitedAt = au.invited_at ?? au.created_at ?? null;
    const confirmed  = Boolean(au.confirmed_at ?? au.email_confirmed_at);

    let status: InviteStatus = "pending";
    if (confirmed) {
      status = "accepted";
    } else if (invitedAt && Date.now() - new Date(invitedAt).getTime() > INVITE_EXPIRY_HOURS * 3_600_000) {
      status = "expired";
    }
    statuses[id] = { status, invitedAt };
  }));

  return NextResponse.json({ statuses });
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { email?: string; role?: string; name?: string };
  const email = body.email?.trim().toLowerCase();
  const role  = body.role;
  const name  = body.name?.trim() || "";

  if (!email || !["user", "admin", "viewer"].includes(role ?? "")) {
    return NextResponse.json({ error: "email and role (user|admin|viewer) are required" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const auth = await requireAdmin(supabase);
  if ("error" in auth) return auth.error;
  const rootAdminId = auth.rootAdminId;

  const origin = request.headers.get("origin") ?? "http://localhost:3000";
  const admin  = createAdminClient();

  const { data: inviteData, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/confirm`,
    data: {
      invited_role: role,
      invited_by:   rootAdminId,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Store the name on the profile immediately after the auth user is created.
  if (name && inviteData?.user?.id) {
    await admin.from("profiles").upsert(
      { user_id: inviteData.user.id, name, email, role, admin_id: rootAdminId },
      { onConflict: "user_id" },
    );
  }

  return NextResponse.json({ ok: true });
}
