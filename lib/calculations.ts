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
 *   OVERTIME – hours beyond `overtimeThreshold` in a single entry → rate ×1.5
 *   TFN/ABN  – first `tfnLimit` hours per Mon–Sun week → TFN salary; excess → ABN invoice
 *              The TFN counter resets every Monday.
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

  let weekRun     = 0;
  let currentWeek = "";

  return sorted.map(entry => {
    const ew = weekStart(entry.date);
    if (ew !== currentWeek) { weekRun = 0; currentWeek = ew; }

    const worked   = calcHours(entry.startTime, entry.endTime) - (entry.breakMins || 0) / 60;
    const total    = entry.officeHours ? Math.max(0, worked) : Math.max(MIN_HOURS, worked);

    const regular  = Math.min(total, overtimeThreshold);
    const overtime = total - regular;

    const tfnPortion = Math.max(0, Math.min(tfnLimit, weekRun + total) - weekRun);
    const abnPortion = total - tfnPortion;

    const rTFN  = Math.max(0, Math.min(regular, tfnPortion));
    const otTFN = Math.max(0, Math.min(total, tfnPortion) - regular);
    const rABN  = Math.max(0, Math.min(regular, total) - tfnPortion);
    const otABN = Math.max(0, total - Math.max(regular, tfnPortion));

    const abnR = entry.hourlyRate;
    const tR   = tfnRate ?? abnR;
    const tfnEarnings = rTFN * tR  + otTFN * tR  * 1.5;
    const abnEarnings = excessMode === "bank" ? 0 : rABN * abnR + otABN * abnR * 1.5;
    const bankHours   = excessMode === "bank" ? abnPortion : 0;

    weekRun += total;

    return {
      ...entry,
      total, regular, overtime,
      tfnPortion, abnPortion, bankHours,
      rTFN, otTFN, rABN, otABN,
      tfnEarnings, abnEarnings,
      totalEarnings: tfnEarnings + abnEarnings,
    };
  });
}
