import type { SupabaseClient } from "@supabase/supabase-js";
import type { Settings } from "@/types";

export const DEFAULT_SETTINGS: Settings = {
  yourName: "", abn: "", yourAddress: "", yourPhone: "", yourEmail: "",
  tfnRate: "", defaultRate: "",
  invoicePrefix: "INV", invoiceNum: 1, invoiceDate: "", invoiceItems: [],
  companyName: "", companyAbn: "", companyAddress: "", companyEmail: "",
  bankName: "", bsb: "", accountNumber: "", invoiceNotes: "",
  tfnLimit: 30, overtimeThreshold: 12, workerType: "site",
  pdfNamePattern: "Invoice-{num}-{company}-{date}",
};

export interface SettingsRow {
  settings: Settings;
  periodStart: string;
  periodEnd: string;
}

export async function getSettings(supabase: SupabaseClient, userId: string): Promise<SettingsRow | null> {
  const { data } = await supabase
    .from("settings").select("*").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  const sd = data as { data: Settings; period_start: string; period_end: string };
  return {
    settings:    { ...DEFAULT_SETTINGS, ...(sd.data ?? {}) },
    periodStart: sd.period_start ?? "",
    periodEnd:   sd.period_end ?? "",
  };
}

export async function getWorkerSettings(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Record<string, Settings>> {
  if (userIds.length === 0) return {};
  const { data } = await supabase
    .from("settings").select("user_id, data")
    .in("user_id", userIds);
  if (!data) return {};
  return Object.fromEntries(
    (data as { user_id: string; data: Settings }[]).map(row => [
      row.user_id,
      { ...DEFAULT_SETTINGS, ...(row.data ?? {}) },
    ])
  );
}

export async function saveWorkerSettings(
  supabase: SupabaseClient,
  workerId: string,
  settings: Settings,
): Promise<boolean> {
  const { error } = await supabase
    .from("settings")
    .update({ data: settings })
    .eq("user_id", workerId);
  return !error;
}

export async function saveSettings(
  supabase: SupabaseClient,
  userId: string,
  settings: Settings,
  periodStart: string,
  periodEnd: string,
): Promise<boolean> {
  const { error } = await supabase.from("settings").upsert({
    user_id: userId, data: settings,
    period_start: periodStart || null,
    period_end:   periodEnd   || null,
  });
  return !error;
}
