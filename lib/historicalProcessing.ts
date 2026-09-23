import type { Entry, ProcessedEntry, SavedInvoice, Settings } from "@/types";
import type { BankClosure } from "@/services/bankClosures";
import { processEntries, weekStart } from "./calculations";

interface Regime {
  tfnLimit: number;
  tfnRate?: number;
  overtimeThreshold: number;
  excessMode: "abn" | "bank";
}

function currentRegime(settings: Settings): Regime {
  return {
    tfnLimit: settings.tfnLimit || 30,
    tfnRate: parseFloat(settings.tfnRate || "") || undefined,
    overtimeThreshold: settings.overtimeThreshold || 12,
    excessMode: settings.excessMode ?? "abn",
  };
}

// Every Mon-Sun week from `start` to `end` (inclusive), as week-start dates.
function weeksBetween(start: string, end: string): string[] {
  const weeks: string[] = [];
  let ws = weekStart(start);
  const last = weekStart(end);
  while (ws <= last) {
    weeks.push(ws);
    const d = new Date(ws + "T12:00:00");
    d.setDate(d.getDate() + 7);
    ws = d.toISOString().slice(0, 10);
  }
  return weeks;
}

// Reprocesses a worker's entries using the settings that were actually in
// effect for each week, not their current settings. Once a week is closed —
// invoiced (ABN) or banked (Hour Bank) — its rate/limit/mode are frozen
// forever via the invoice's or bank_closure's own settings snapshot, so
// switching modes or changing rates later never rewrites past weeks. Weeks
// with no such record (still open, or closed before this tracking existed)
// fall back to the worker's current settings.
export function processEntriesWithHistory(
  entries: Entry[],
  settings: Settings,
  invoices: SavedInvoice[],
  bankClosures: BankClosure[],
): ProcessedEntry[] {
  const regimeByWeek = new Map<string, Regime>();

  for (const inv of invoices) {
    const s = inv.data.settings;
    const regime: Regime = {
      tfnLimit: s.tfnLimit || 30,
      tfnRate: parseFloat(s.tfnRate || "") || undefined,
      overtimeThreshold: s.overtimeThreshold || 12,
      excessMode: "abn",
    };
    for (const ws of weeksBetween(inv.data.periodStart, inv.data.periodEnd)) {
      regimeByWeek.set(ws, regime);
    }
  }

  for (const c of bankClosures) {
    regimeByWeek.set(c.weekStart, {
      tfnLimit: c.tfnLimit ?? settings.tfnLimit ?? 30,
      tfnRate: c.tfnRate ?? (parseFloat(settings.tfnRate || "") || undefined),
      overtimeThreshold: c.overtimeThreshold ?? (settings.overtimeThreshold || 12),
      excessMode: "bank",
    });
  }

  const live = currentRegime(settings);
  const byWeek = new Map<string, Entry[]>();
  for (const e of entries) {
    const ws = weekStart(e.date);
    if (!byWeek.has(ws)) byWeek.set(ws, []);
    byWeek.get(ws)!.push(e);
  }

  // processEntries' weekly TFN budget resets every Monday internally, so
  // processing one week at a time (each under its own regime) is equivalent
  // to processing the whole list under a single regime.
  const result: ProcessedEntry[] = [];
  for (const [ws, weekEntries] of byWeek) {
    const r = regimeByWeek.get(ws) ?? live;
    result.push(...processEntries(weekEntries, r.tfnLimit, r.tfnRate, r.overtimeThreshold, r.excessMode));
  }
  return result;
}

// Which mode actually governed a given week — for labeling reports. Mirrors
// the same precedence as processEntriesWithHistory: invoice > bank closure >
// the worker's current mode (for weeks not yet closed either way).
export function weekModeMap(
  invoices: SavedInvoice[],
  bankClosures: BankClosure[],
): Map<string, "abn" | "bank"> {
  const modes = new Map<string, "abn" | "bank">();
  for (const inv of invoices) {
    for (const ws of weeksBetween(inv.data.periodStart, inv.data.periodEnd)) modes.set(ws, "abn");
  }
  for (const c of bankClosures) modes.set(c.weekStart, "bank");
  return modes;
}
