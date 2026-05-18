import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditEntry } from "@/types";

export async function logActivity(
  supabase: SupabaseClient,
  adminId:    string,
  actorId:    string,
  action:     string,
  targetType: string | null = null,
  targetId:   string | null = null,
  meta:       Record<string, unknown> = {},
): Promise<void> {
  await supabase.from("audit_log").insert({
    admin_id:    adminId,
    actor_id:    actorId,
    action,
    target_type: targetType,
    target_id:   targetId,
    meta,
  });
}

export async function getAuditLog(supabase: SupabaseClient, limit = 100): Promise<AuditEntry[]> {
  const { data } = await supabase
    .from("audit_log")
    .select("id, admin_id, actor_id, action, target_type, target_id, meta, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map(r => ({
    id:         r.id,
    adminId:    r.admin_id,
    actorId:    r.actor_id,
    action:     r.action,
    targetType: r.target_type ?? null,
    targetId:   r.target_id  ?? null,
    meta:       r.meta       ?? {},
    createdAt:  r.created_at,
  }));
}
