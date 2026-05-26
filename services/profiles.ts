import type { SupabaseClient } from "@supabase/supabase-js";
import type { ManagedUser, UserRole } from "@/types";

// Returns false if no profile exists (user was not invited).
// Never creates a new profile — only updates email on an existing one.
export async function ensureProfile(supabase: SupabaseClient, userId: string, email: string | undefined): Promise<boolean> {
  const { data } = await supabase
    .from("profiles").select("user_id").eq("user_id", userId).maybeSingle();
  if (!data) return false;
  if (email) await supabase.from("profiles").update({ email }).eq("user_id", userId);
  return true;
}

export async function getProfile(supabase: SupabaseClient, userId: string): Promise<{ role: UserRole; adminId: string | null }> {
  const { data } = await supabase
    .from("profiles").select("role, admin_id").eq("user_id", userId).maybeSingle();
  const p = data as Record<string, unknown> | null;
  const raw = (p?.role as string) ?? "user";
  const role: UserRole = (["user", "admin", "viewer"] as const).includes(raw as UserRole)
    ? (raw as UserRole)
    : "user";
  return { role, adminId: (p?.admin_id as string) ?? null };
}

async function resolveRootAdminId(supabase: SupabaseClient, adminId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles").select("admin_id, role")
    .eq("user_id", adminId).maybeSingle();
  const p = data as { admin_id: string | null; role: string } | null;
  return (p?.role === "admin" && p?.admin_id) ? p.admin_id : adminId;
}

function rowsToUsers(data: unknown[]): ManagedUser[] {
  return (data as Record<string, unknown>[]).map(p => ({
    id:    p.user_id as string,
    name:  (p.name as string) || (p.email as string) || "Unknown",
    email: (p.email as string) || "",
  }));
}

export async function getManagedUsers(supabase: SupabaseClient, adminId: string): Promise<ManagedUser[]> {
  const rootAdminId = await resolveRootAdminId(supabase, adminId);
  const { data } = await supabase
    .from("profiles").select("user_id, name, email")
    .eq("admin_id", rootAdminId)
    .eq("role", "user");
  return rowsToUsers(data ?? []);
}

export async function getManagedAdmins(supabase: SupabaseClient, adminId: string): Promise<ManagedUser[]> {
  const rootAdminId = await resolveRootAdminId(supabase, adminId);
  const { data } = await supabase
    .from("profiles").select("user_id, name, email")
    .eq("admin_id", rootAdminId)
    .eq("role", "admin");
  return rowsToUsers(data ?? []);
}

// Resolves root admin ID once then fetches workers, co-admins, and viewers in parallel.
export async function getManagedTeam(
  supabase: SupabaseClient,
  adminId: string,
): Promise<{ users: ManagedUser[]; admins: ManagedUser[]; viewers: ManagedUser[] }> {
  const rootAdminId = await resolveRootAdminId(supabase, adminId);
  const [usersRes, adminsRes, viewersRes] = await Promise.all([
    supabase.from("profiles").select("user_id, name, email").eq("admin_id", rootAdminId).eq("role", "user"),
    supabase.from("profiles").select("user_id, name, email").eq("admin_id", rootAdminId).eq("role", "admin").neq("user_id", rootAdminId),
    supabase.from("profiles").select("user_id, name, email").eq("admin_id", rootAdminId).eq("role", "viewer"),
  ]);
  return {
    users:   rowsToUsers(usersRes.data   ?? []),
    admins:  rowsToUsers(adminsRes.data  ?? []),
    viewers: rowsToUsers(viewersRes.data ?? []),
  };
}
