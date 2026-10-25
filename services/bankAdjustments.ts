import type { SupabaseClient } from "@supabase/supabase-js";

// Manual change to a worker's Hour Bank balance, recorded by their admin.
// hours is signed: negative = hours paid out (deducted), positive = added.
export interface BankAdjustment {
  id: string;
  userId: string;
  createdBy: string;
  date: string;
  hours: number;
  note: string;
  createdAt: string;
}

function fromRow(row: Record<string, unknown>): BankAdjustment {
  return {
    id:        row.id as string,
    userId:    row.user_id as string,
    createdBy: row.created_by as string,
    date:      row.date as string,
    hours:     Number(row.hours),
    note:      (row.note as string) ?? "",
    createdAt: row.created_at as string,
  };
}

export async function getBankAdjustments(supabase: SupabaseClient, userId: string): Promise<BankAdjustment[]> {
  const { data } = await supabase
    .from("bank_adjustments").select("*").eq("user_id", userId)
    .order("date", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map(fromRow);
}

export async function getBankAdjustmentsForWorkers(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Record<string, BankAdjustment[]>> {
  if (userIds.length === 0) return {};
  const { data } = await supabase
    .from("bank_adjustments").select("*").in("user_id", userIds)
    .order("date", { ascending: false });
  const result: Record<string, BankAdjustment[]> = {};
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const adj = fromRow(row);
    (result[adj.userId] ??= []).push(adj);
  }
  return result;
}

export async function saveBankAdjustment(
  supabase: SupabaseClient,
  params: { userId: string; createdBy: string; date: string; hours: number; note: string },
): Promise<BankAdjustment | null> {
  const { data, error } = await supabase.from("bank_adjustments").insert({
    user_id:    params.userId,
    created_by: params.createdBy,
    date:       params.date,
    hours:      params.hours,
    note:       params.note,
  }).select().single();
  if (error || !data) return null;
  return fromRow(data as Record<string, unknown>);
}

export async function deleteBankAdjustment(supabase: SupabaseClient, id: string): Promise<boolean> {
  const { error } = await supabase.from("bank_adjustments").delete().eq("id", id);
  return !error;
}
