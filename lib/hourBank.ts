import type { ProcessedEntry } from "@/types";
import type { BankClosure } from "@/services/bankClosures";
import type { BankAdjustment } from "@/services/bankAdjustments";

// A worker's Hour Bank balance: hours frozen in closed bank weeks, plus any
// admin adjustments (payouts are negative), plus hours accruing in open
// (not yet closed) entries under the worker's current settings.
export function bankBalance(
  closures: BankClosure[],
  adjustments: BankAdjustment[],
  openProcessed: ProcessedEntry[],
): { closed: number; adjusted: number; pending: number; balance: number } {
  const closed   = closures.filter(c => c.mode === "bank").reduce((a, c) => a + c.hours, 0);
  const adjusted = adjustments.reduce((a, adj) => a + adj.hours, 0);
  const pending  = openProcessed.filter(e => !e.archived).reduce((a, e) => a + e.bankHours, 0);
  return { closed, adjusted, pending, balance: closed + adjusted + pending };
}
