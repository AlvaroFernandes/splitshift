import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { rowToEntry } from "@/services/entries";

// Resolves the root admin ID for any admin/viewer caller.
async function resolveRootAdminId(adminClient: ReturnType<typeof createAdminClient>, userId: string): Promise<string> {
  const { data } = await adminClient
    .from("profiles").select("role, admin_id").eq("user_id", userId).maybeSingle();
  const p = data as { role: string; admin_id: string | null } | null;
  return (p?.role === "admin" && p?.admin_id) ? p.admin_id : userId;
}

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  // Verify caller is admin or viewer
  const { data: profile } = await supabase
    .from("profiles").select("role, admin_id").eq("user_id", user.id).maybeSingle();
  const p = profile as { role: string; admin_id: string | null } | null;
  if (!p || (p.role !== "admin" && p.role !== "viewer")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const rootAdminId = await resolveRootAdminId(admin, user.id);

  // Get all worker IDs under this root admin
  const { data: workerProfiles } = await admin
    .from("profiles").select("user_id")
    .eq("admin_id", rootAdminId).eq("role", "user");
  const workerIds = ((workerProfiles ?? []) as { user_id: string }[]).map(r => r.user_id);

  if (workerIds.length === 0) return NextResponse.json([]);

  const { data: rows } = await admin
    .from("entries").select("*")
    .in("user_id", workerIds).is("deleted_at", null)
    .order("date").order("start_time");

  const entries = ((rows ?? []) as Record<string, unknown>[]).map(rowToEntry);
  return NextResponse.json(entries);
}
