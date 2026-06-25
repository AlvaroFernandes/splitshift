import type { Entry, ProcessedEntry } from "@/types";

export const MIN_HOURS = 4;

export function calcHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 1440;
  return +(mins / 60).toFixed(6);
}

// Monday-anchored ISO week start (noon avoids DST ambiguity)
export function weekStart(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay(); // 0 = Sun
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
}

/**
 * Processes entries into billable buckets.
 *
 * Two independent splits per entry:
 *   OVERTIME – hours beyond `overtimeThreshold` in a single entry
 *   TFN/ABN  – first `tfnLimit` weighted hours per Mon–Sun week → TFN salary;
 *              excess → ABN invoice. The TFN counter resets every Monday.
 *
 * TFN salary model (when tfnRate is set):
 *   - TFN pay for a week is always tfnLimit × tfnRate (fixed salary).
 *   - Overtime hours cost 1.5× toward the TFN weekly budget, so they exhaust
 *     it faster (e.g. 3 OT hours consume 4.5 weighted hours from the budget).
 *   - There is no overtime pay bonus — earnings stay at tfnRate per weighted
 *     hour, so total TFN pay is always exactly tfnLimit × tfnRate per week.
 *   - If a worker logs fewer weighted hours than tfnLimit, the salary top-up
 *     is added to the last TFN entry of that week so all sums remain consistent.
 *
 * The intersection produces four buckets per entry: rTFN, otTFN, rABN, otABN.
 */
export function processEntries(
  entries: Entry[],
  tfnLimit = 30,
  tfnRate?: number,
  overtimeThreshold = 12,
  excessMode: "abn" | "bank" = "abn",
): ProcessedEntry[] {
  const sorted = [...entries].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : a.startTime.localeCompare(b.startTime);
  });

  // weekRun tracks WEIGHTED TFN hours consumed (regular = 1×, overtime = 1.5×)
  let weekRun     = 0;
  let currentWeek = "";

  const processed = sorted.map(entry => {
    const ew = weekStart(entry.date);
    if (ew !== currentWeek) { weekRun = 0; currentWeek = ew; }

    const worked   = calcHours(entry.startTime, entry.endTime) - (entry.breakMins || 0) / 60;
    const total    = entry.officeHours ? Math.max(0, worked) : Math.max(MIN_HOURS, worked);

    const regular  = Math.min(total, overtimeThreshold);
    const overtime = total - regular;

    // Weighted cost of this entry: OT hours count 1.5× toward the TFN budget
    const weightedCost    = regular + overtime * 1.5;
    const tfnBudgetLeft   = Math.max(0, tfnLimit - weekRun);
    const tfnWeightedUsed = Math.min(weightedCost, tfnBudgetLeft);

    // Split actual hours into TFN / ABN buckets based on weighted budget
    let rTFN: number, otTFN: number, rABN: number, otABN: number;
    if (tfnWeightedUsed <= regular) {
      // Budget exhausted within the regular portion of this entry
      rTFN = tfnWeightedUsed;
      otTFN = 0;
      rABN  = regular - rTFN;
      otABN = overtime;
    } else {
      // Budget covers all regular hours and part (or all) of overtime
      rTFN = regular;
      otTFN = (tfnWeightedUsed - regular) / 1.5;
      rABN  = 0;
      otABN = overtime - otTFN;
    }

    const tfnPortion = rTFN + otTFN;
    const abnPortion = total - tfnPortion;

    const abnR = entry.hourlyRate;
    const tR   = tfnRate ?? abnR;
    // tfnEarnings = tR × weighted hours used = rTFN×tR + otTFN×tR×1.5
    // When the weekly budget is fully consumed this sums to tfnLimit × tR exactly.
    const tfnEarnings = rTFN * tR + otTFN * tR * 1.5;
    const abnEarnings = excessMode === "bank" ? 0 : rABN * abnR + otABN * abnR * 1.5;
    const bankHours   = excessMode === "bank" ? abnPortion : 0;

    weekRun += tfnWeightedUsed;

    return {
      ...entry,
      total, regular, overtime,
      tfnPortion, abnPortion, bankHours,
      rTFN, otTFN, rABN, otABN,
      tfnEarnings, abnEarnings,
      totalEarnings: tfnEarnings + abnEarnings,
    };
  });

  // Salary top-up: if a week's weighted TFN hours are below tfnLimit (worker
  // logged fewer hours than the budget), add the shortfall × tfnRate to the
  // last TFN entry so the weekly total always equals tfnLimit × tfnRate.
  if (tfnRate !== undefined) {
    const weekGroups = new Map<string, number[]>();
    for (let i = 0; i < processed.length; i++) {
      const ws = weekStart(processed[i].date);
      if (!weekGroups.has(ws)) weekGroups.set(ws, []);
      weekGroups.get(ws)!.push(i);
    }
    for (const indices of weekGroups.values()) {
      const weekWeightedTfn = indices.reduce((s, i) => {
        const e = processed[i];
        return s + e.rTFN + e.otTFN * 1.5;
      }, 0);
      if (weekWeightedTfn < tfnLimit) {
        const lastTfnIdx = [...indices].reverse().find(i => processed[i].tfnPortion > 0);
        if (lastTfnIdx !== undefined) {
          const adj = (tfnLimit - weekWeightedTfn) * tfnRate;
          const e = processed[lastTfnIdx];
          processed[lastTfnIdx] = { ...e, tfnEarnings: e.tfnEarnings + adj, totalEarnings: e.totalEarnings + adj };
        }
      }
    }
  }

  return processed;
}
