export interface Entry {
  id: string;
  date: string;
  jobDescription: string;
  startTime: string;
  endTime: string;
  hourlyRate: number;
  breakMins: number;
  archived?: boolean;
  officeHours?: boolean;
  client?: string;
  ownerId?: string; // admin: the user_id who owns this entry
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
}

export type UserRole = "user" | "admin" | "viewer";

export interface ProcessedEntry extends Entry {
  total: number;
  regular: number;
  overtime: number;
  tfnPortion: number;
  abnPortion: number;
  bankHours: number;
  rTFN: number;
  otTFN: number;
  rABN: number;
  otABN: number;
  tfnEarnings: number;
  abnEarnings: number;
  totalEarnings: number;
}

export interface EntryTemplate {
  id: string;
  jobDescription: string;
  client?: string;
  hourlyRate?: string;
  startTime?: string;
  endTime?: string;
}

export interface InvoiceItem {
  id: string;
  date: string;
  description: string;
  amount: number;
}

export interface Settings {
  yourName: string;
  abn: string;
  yourAddress: string;
  yourPhone: string;
  yourEmail: string;
  tfnRate: string;
  defaultRate: string;
  invoicePrefix: string;
  invoiceNum: number;
  invoiceDate: string;
  invoiceItems: InvoiceItem[];
  companyName: string;
  companyAbn: string;
  companyAddress: string;
  companyEmail: string;
  bankName: string;
  bsb: string;
  accountNumber: string;
  invoiceNotes: string;
  tfnLimit: number;
  overtimeThreshold: number;
  excessMode?: "abn" | "bank";
  pdfNamePattern: string;
  templates?: EntryTemplate[];
  reminderEnabled?: boolean;
  reminderDays?: number;
  gstRegistered?: boolean;
  onboardingCompleted?: boolean;
}

export interface Totals {
  hours: number;
  tfnHours: number;
  abnHours: number;
  bankHours: number;
  otHours: number;
  tfnEarnings: number;
  abnEarnings: number;
  total: number;
}

export interface FormState {
  date: string;
  jobDescription: string;
  startTime: string;
  endTime: string;
  hourlyRate: string;
  breakMins: string;
  client: string;
  officeHours?: boolean;
}

export interface Toast {
  msg: string;
  type: "ok" | "err";
}

export interface InvLineRow {
  key: string;
  date: string;
  startTime?: string;
  description: string;
  client?: string;
  rate: number | null;
  hours: number | null;
  amount: number;
  entryId?: string; // set when this row was derived from a work entry, so it can be regenerated if that entry is later edited
}

export interface AuditEntry {
  id: string;
  adminId: string;
  actorId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface SavedInvoice {
  id: string;
  invoiceNum: number;
  issueDate: string;
  companyName: string;
  subtotal: number;
  createdAt: string;
  shareToken?: string;
  data: {
    settings: Partial<Settings>;
    rows: InvLineRow[];
    periodStart: string;
    periodEnd: string;
  };
}
