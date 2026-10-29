import type { Entry, ProcessedEntry, SavedInvoice, Settings } from "@/types";
import type { BankClosure } from "@/services/bankClosures";
import { processEntries, weekStart, budgetPeriod, limitPeriodOf, type LimitPeriod } from "./calculations";

interface Regime {
  tfnLimit: number;
  tfnRate?: number;
  overtimeThreshold: number;
  excessMode: "abn" | "bank";
  limitPeriod: LimitPeriod;
}

function currentRegime(settings: Settings): Regime {
  return {
    tfnLimit: settings.tfnLimit ?? 30,
    tfnRate: parseFloat(settings.tfnRate || "") || undefined,
    overtimeThreshold: settings.overtimeThreshold || 12,
    excessMode: settings.excessMode ?? "abn",
    limitPeriod: limitPeriodOf(settings),
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
      tfnLimit: s.tfnLimit ?? 30,
      tfnRate: parseFloat(s.tfnRate || "") || undefined,
      overtimeThreshold: s.overtimeThreshold || 12,
      excessMode: "abn",
      limitPeriod: "week",
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
      excessMode: c.mode,
      limitPeriod: limitPeriodOf({ excessMode: c.mode, limitPeriod: c.limitPeriod }),
    });
  }

  const live = currentRegime(settings);

  // Group entries by their week's regime and by the TFN budget period that
  // regime uses (a week, or a calendar month), then process each group on
  // its own. processEntries resets the budget per period internally, so this
  // matches processing everything under a single regime. A monthly budget
  // spans every week of the month that shares the same regime.
  const groups = new Map<string, { r: Regime; entries: Entry[] }>();
  for (const e of entries) {
    const r = regimeByWeek.get(weekStart(e.date)) ?? live;
    const key = `${JSON.stringify(r)}|${budgetPeriod(e.date, r.limitPeriod)}`;
    if (!groups.has(key)) groups.set(key, { r, entries: [] });
    groups.get(key)!.entries.push(e);
  }

  const result: ProcessedEntry[] = [];
  for (const { r, entries: groupEntries } of groups.values()) {
    result.push(...processEntries(groupEntries, r.tfnLimit, r.tfnRate, r.overtimeThreshold, r.excessMode, r.limitPeriod));
  }
  return result;
}

// Which mode actually governed a given week — for labeling reports. Mirrors
// the same precedence as processEntriesWithHistory: invoice > week closure >
// the worker's current mode (for weeks not yet closed either way).
export function weekModeMap(
  invoices: SavedInvoice[],
  bankClosures: BankClosure[],
): Map<string, "abn" | "bank"> {
  const modes = new Map<string, "abn" | "bank">();
  for (const inv of invoices) {
    for (const ws of weeksBetween(inv.data.periodStart, inv.data.periodEnd)) modes.set(ws, "abn");
  }
  for (const c of bankClosures) modes.set(c.weekStart, c.mode);
  return modes;
}
