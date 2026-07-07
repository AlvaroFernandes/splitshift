import type { SupabaseClient } from "@supabase/supabase-js";
import type { SavedInvoice, InvLineRow, Settings } from "@/types";

export function fromInvoiceRow(row: Record<string, unknown>): SavedInvoice {
  return {
    id:          row.id as string,
    invoiceNum:  row.invoice_num as number,
    issueDate:   row.issue_date as string,
    companyName: (row.company_name as string) || "",
    subtotal:    Number(row.subtotal),
    createdAt:   row.created_at as string,
    shareToken:  (row.share_token as string) || undefined,
    data:        row.data as SavedInvoice["data"],
  };
}

export async function getInvoices(supabase: SupabaseClient, userId: string): Promise<SavedInvoice[]> {
  const { data } = await supabase
    .from("invoices").select("*").eq("user_id", userId)
    .order("invoice_num", { ascending: false }).limit(50);
  return ((data ?? []) as Record<string, unknown>[]).map(fromInvoiceRow);
}

export interface SaveInvoiceParams {
  id: string;
  userId: string;
  invoiceNum: number;
  issueDate: string;
  companyName: string;
  subtotal: number;
  settings: Partial<Settings>;
  rows: InvLineRow[];
  periodStart: string;
  periodEnd: string;
}

export async function saveInvoice(
  supabase: SupabaseClient,
  params: SaveInvoiceParams,
): Promise<SavedInvoice | null> {
  const { data, error } = await supabase.from("invoices").insert({
    id:           params.id,
    user_id:      params.userId,
    invoice_num:  params.invoiceNum,
    issue_date:   params.issueDate,
    company_name: params.companyName,
    subtotal:     params.subtotal,
    data: {
      settings:    params.settings,
      rows:        params.rows,
      periodStart: params.periodStart,
      periodEnd:   params.periodEnd,
    },
  }).select().single();
  if (error || !data) return null;
  return fromInvoiceRow(data as Record<string, unknown>);
}

export interface UpdateInvoiceParams {
  id: string;
  issueDate: string;
  companyName: string;
  subtotal: number;
  data: SavedInvoice["data"];
}

export async function updateInvoice(supabase: SupabaseClient, params: UpdateInvoiceParams): Promise<boolean> {
  const { error } = await supabase.from("invoices").update({
    issue_date:   params.issueDate,
    company_name: params.companyName,
    subtotal:     params.subtotal,
    data:         params.data,
  }).eq("id", params.id);
  return !error;
}

export async function deleteInvoice(supabase: SupabaseClient, id: string): Promise<boolean> {
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  return !error;
}

export async function generateShareToken(supabase: SupabaseClient, invoiceId: string): Promise<string | null> {
  const token = crypto.randomUUID();
  const { error } = await supabase.from("invoices").update({ share_token: token }).eq("id", invoiceId);
  if (error) return null;
  return token;
}

export async function getInvoiceByToken(supabase: SupabaseClient, token: string): Promise<SavedInvoice | null> {
  const { data } = await supabase
    .from("invoices").select("*").eq("share_token", token).maybeSingle();
  if (!data) return null;
  return fromInvoiceRow(data as Record<string, unknown>);
}
