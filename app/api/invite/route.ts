import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const body = await request.json() as { email?: string; role?: string; name?: string };
  const email = body.email?.trim().toLowerCase();
  const role  = body.role;
  const name  = body.name?.trim() || "";

  if (!email || !["user", "admin", "viewer"].includes(role ?? "")) {
    return NextResponse.json({ error: "email and role (user|admin|viewer) are required" }, { status: 400 });
  }

  // Verify the caller is an authenticated admin
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { data: callerProfile } = await supabase
    .from("profiles").select("role, admin_id")
    .eq("user_id", user.id).maybeSingle();

  const p = callerProfile as { role: string; admin_id: string | null } | null;
  if (p?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Root admin ID: sub-admins pass their parent's ID so all invited users
  // end up under the same root admin pool.
  const rootAdminId = p.admin_id ?? user.id;

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
