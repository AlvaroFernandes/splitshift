import type { SupabaseClient } from "@supabase/supabase-js";

export interface BankClosure {
  id: string;
  userId: string;
  weekStart: string;
  weekEnd: string;
  hours: number;
  createdAt: string;
  // Frozen at closing time — undefined for closures saved before this was
  // tracked, in which case callers should fall back to current settings.
  tfnLimit?: number;
  tfnRate?: number;
  overtimeThreshold?: number;
}

function fromRow(row: Record<string, unknown>): BankClosure {
  return {
    id:        row.id as string,
    userId:    row.user_id as string,
    weekStart: row.week_start as string,
    weekEnd:   row.week_end as string,
    hours:     Number(row.hours),
    createdAt: row.created_at as string,
    tfnLimit:          row.tfn_limit          != null ? Number(row.tfn_limit)          : undefined,
    tfnRate:           row.tfn_rate           != null ? Number(row.tfn_rate)           : undefined,
    overtimeThreshold: row.overtime_threshold != null ? Number(row.overtime_threshold) : undefined,
  };
}

export async function getBankClosures(supabase: SupabaseClient, userId: string): Promise<BankClosure[]> {
  const { data } = await supabase
    .from("bank_closures").select("*").eq("user_id", userId)
    .order("week_start", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map(fromRow);
}

// One row per worker per week — safe to call even if the week was already
// closed (e.g. a retry), since (user_id, week_start) is unique.
export async function saveBankClosure(
  supabase: SupabaseClient,
  params: {
    userId: string; weekStart: string; weekEnd: string; hours: number;
    tfnLimit: number; tfnRate?: number; overtimeThreshold: number;
  },
): Promise<BankClosure | null> {
  const { data, error } = await supabase.from("bank_closures").upsert({
    user_id:            params.userId,
    week_start:         params.weekStart,
    week_end:           params.weekEnd,
    hours:              params.hours,
    tfn_limit:          params.tfnLimit,
    tfn_rate:           params.tfnRate ?? null,
    overtime_threshold: params.overtimeThreshold,
  }, { onConflict: "user_id,week_start" }).select().single();
  if (error || !data) return null;
  return fromRow(data as Record<string, unknown>);
}
