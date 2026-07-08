import type { SupabaseClient } from "@supabase/supabase-js";
import type { Entry } from "@/types";

export function rowToEntry(row: Record<string, unknown>): Entry {
  return {
    id:             row.id as string,
    date:           row.date as string,
    jobDescription: row.job_description as string,
    startTime:      (row.start_time as string).slice(0, 5),
    endTime:        (row.end_time   as string).slice(0, 5),
    hourlyRate:     Number(row.hourly_rate),
    breakMins:      Number(row.break_mins) || 0,
    archived:       !!(row.archived),
    officeHours:    !!(row.office_hours),
    client:         (row.client as string) || undefined,
    ownerId:        row.user_id as string,
  };
}

export function entryToRow(entry: Entry, userId: string): Record<string, unknown> {
  return {
    id:              entry.id,
    user_id:         userId,
    date:            entry.date,
    job_description: entry.jobDescription,
    start_time:      entry.startTime,
    end_time:        entry.endTime,
    hourly_rate:     entry.hourlyRate,
    break_mins:      entry.breakMins,
    archived:        entry.archived ?? false,
    office_hours:    entry.officeHours ?? false,
    client:          entry.client?.trim() || null,
  };
}

export async function getEntries(supabase: SupabaseClient, userId: string): Promise<Entry[]> {
  const { data } = await supabase
    .from("entries").select("*")
    .eq("user_id", userId).is("deleted_at", null)
    .order("date").order("start_time");
  return ((data ?? []) as Record<string, unknown>[]).map(rowToEntry);
}

export async function getAdminEntries(supabase: SupabaseClient, userIds: string[]): Promise<Entry[]> {
  if (userIds.length === 0) return [];
  const { data } = await supabase
    .from("entries").select("*")
    .in("user_id", userIds).is("deleted_at", null)
    .order("date").order("start_time");
  return ((data ?? []) as Record<string, unknown>[]).map(rowToEntry);
}

export async function upsertEntry(supabase: SupabaseClient, entry: Entry, userId: string): Promise<boolean> {
  const { error } = await supabase.from("entries").upsert(entryToRow(entry, userId));
  return !error;
}

export async function deleteEntry(supabase: SupabaseClient, id: string): Promise<boolean> {
  const { error } = await supabase
    .from("entries").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  return !error;
}

export async function archiveEntries(supabase: SupabaseClient, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const { error } = await supabase.from("entries").update({ archived: true }).in("id", ids);
  return !error;
}

export async function unarchiveEntries(supabase: SupabaseClient, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const { error } = await supabase.from("entries").update({ archived: false }).in("id", ids);
  return !error;
}
