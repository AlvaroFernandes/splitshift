import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

// Long enough to never lapse in practice; Supabase has no "permanent" ban.
const BAN_FOREVER = "876000h"; // ~100 years

// Verifies the caller is an admin and that `userId` is on their team (and
// isn't the caller or the account owner). Returns the service-role client.
async function requireTeamMember(userId: string | undefined) {
  if (!userId) return { error: NextResponse.json({ error: "userId is required" }, { status: 400 }) } as const;

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }) } as const;

  const { data: callerProfile } = await supabase
    .from("profiles").select("role, admin_id")
    .eq("user_id", user.id).maybeSingle();
  const p = callerProfile as { role: string; admin_id: string | null } | null;
  if (p?.role !== "admin") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  const rootAdminId = p.admin_id ?? user.id;

  if (userId === user.id || userId === rootAdminId) {
    return { error: NextResponse.json({ error: "You can't change your own account or the account owner here" }, { status: 400 }) } as const;
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles").select("admin_id")
    .eq("user_id", userId).maybeSingle();
  if (!target || (target as { admin_id: string | null }).admin_id !== rootAdminId) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  }
  return { admin } as const;
}

// Removes someone from the caller's team, or restores them. Removal keeps all
// of their data — it only flags the profile and bans the auth user so they can
// no longer sign in or refresh their session.
export async function POST(request: NextRequest) {
  const { userId, action } = await request.json() as { userId?: string; action?: string };
  if (action !== "remove" && action !== "restore") {
    return NextResponse.json({ error: "action must be remove or restore" }, { status: 400 });
  }
  const auth = await requireTeamMember(userId);
  if ("error" in auth) return auth.error;
  const { admin } = auth;

  const removing = action === "remove";
  const { error: banErr } = await admin.auth.admin.updateUserById(userId!, {
    ban_duration: removing ? BAN_FOREVER : "none",
  });
  if (banErr) return NextResponse.json({ error: banErr.message }, { status: 400 });

  const { error: profErr } = await admin
    .from("profiles")
    .update({ removed_at: removing ? new Date().toISOString() : null })
    .eq("user_id", userId!);
  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

// Updates a team member's name and/or sign-in email. Profiles are only
// writable by their owner under RLS, so this runs with the service role.
export async function PATCH(request: NextRequest) {
  const body = await request.json() as { userId?: string; name?: string; email?: string; teamAccess?: boolean };
  const auth = await requireTeamMember(body.userId);
  if ("error" in auth) return auth.error;
  const { admin } = auth;
  const userId = body.userId!;

  const changes: { name?: string; email?: string; team_access?: boolean } = {};
  if (typeof body.name === "string") changes.name = body.name.trim();
  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }
    changes.email = email;
  }
  // Accountant access: read-only view of the whole team's reports/invoices.
  if (typeof body.teamAccess === "boolean") changes.team_access = body.teamAccess;
  if (!changes.name && !changes.email && changes.team_access === undefined) return NextResponse.json({ ok: true });

  if (changes.email) {
    // Confirmed straight away — the admin vouches for the new address, and the
    // person signs in with it from now on.
    const { error } = await admin.auth.admin.updateUserById(userId, { email: changes.email, email_confirm: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { error } = await admin.from("profiles").update(changes).eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
