import { describe, it, expect } from "vitest";
import { processEntriesWithHistory, weekModeMap } from "@/lib/historicalProcessing";
import { DEFAULT_SETTINGS } from "@/services/settings";
import type { BankClosure } from "@/services/bankClosures";
import type { Entry, Settings } from "@/types";

// A worker now on Hour Bank (limit 50h) whose week of 13 Jul was closed
// under ABN (limit 30h) without an invoice, since it stayed within the limit.
const current: Settings = { ...DEFAULT_SETTINGS, excessMode: "bank", tfnLimit: 50, tfnRate: "42" };

const closedAbnWeek: BankClosure = {
  id: "c1", userId: "u1", weekStart: "2026-07-13", weekEnd: "2026-07-19",
  hours: 0, createdAt: "2026-07-20T00:00:00Z", mode: "abn",
  tfnLimit: 30, tfnRate: 40, overtimeThreshold: 12,
};

const entries: Entry[] = [
  { id: "e1", date: "2026-07-13", jobDescription: "Job", startTime: "07:00", endTime: "17:00", hourlyRate: 40, breakMins: 0, archived: true },
];

describe("ABN weeks closed without an invoice", () => {
  it("keeps the ABN label after the worker switches to Hour Bank", () => {
    expect(weekModeMap([], [closedAbnWeek]).get("2026-07-13")).toBe("abn");
  });

  it("is processed under the frozen ABN regime, not the current one", () => {
    const [e] = processEntriesWithHistory(entries, current, [], [closedAbnWeek]);
    expect(e.bankHours).toBe(0);
    // Fixed salary: frozen tfnLimit × frozen tfnRate (30 × $40), not 50 × $42.
    expect(e.tfnEarnings).toBeCloseTo(30 * 40);
  });

  it("falls back to the current mode when no closure exists", () => {
    expect(weekModeMap([], []).get("2026-07-13")).toBeUndefined();
    const [e] = processEntriesWithHistory(entries, current, [], []);
    expect(e.tfnEarnings).toBeCloseTo(50 * 42);
  });
});
