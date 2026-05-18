import { describe, it, expect } from "vitest";
import { calcHours, weekStart, processEntries, MIN_HOURS } from "@/lib/calculations";
import type { Entry } from "@/types";

// ─── helpers ────────────────────────────────────────────────────────────────

function entry(overrides: Partial<Entry> & { id: string; date: string; startTime: string; endTime: string; hourlyRate: number }): Entry {
  return {
    jobDescription: "Test job",
    breakMins: 0,
    ...overrides,
  };
}

// ─── calcHours ───────────────────────────────────────────────────────────────

describe("calcHours", () => {
  it("returns correct hours for a standard shift", () => {
    expect(calcHours("09:00", "17:00")).toBeCloseTo(8);
  });

  it("handles a half-hour shift", () => {
    expect(calcHours("09:00", "09:30")).toBeCloseTo(0.5);
  });

  it("handles overnight shift (crosses midnight)", () => {
    expect(calcHours("22:00", "06:00")).toBeCloseTo(8);
  });

  it("handles 1-minute-past-midnight shift", () => {
    expect(calcHours("23:59", "00:00")).toBeCloseTo(1 / 60);
  });

  it("returns 0 when start or end is empty", () => {
    expect(calcHours("", "09:00")).toBe(0);
    expect(calcHours("09:00", "")).toBe(0);
    expect(calcHours("", "")).toBe(0);
  });

  it("returns a full day (24h) when start equals end", () => {
    // same time wraps around to 24h (1440 mins)
    expect(calcHours("09:00", "09:00")).toBeCloseTo(24);
  });
});

// ─── weekStart ───────────────────────────────────────────────────────────────

describe("weekStart", () => {
  it("returns the same date for a Monday", () => {
    expect(weekStart("2026-05-18")).toBe("2026-05-18"); // Monday
  });

  it("returns the previous Monday for a Sunday", () => {
    expect(weekStart("2026-05-17")).toBe("2026-05-11"); // Sun → Mon
  });

  it("returns the previous Monday for a Wednesday", () => {
    expect(weekStart("2026-05-20")).toBe("2026-05-18"); // Wed → Mon
  });

  it("returns the previous Monday for a Saturday", () => {
    expect(weekStart("2026-05-23")).toBe("2026-05-18"); // Sat → Mon
  });

  it("is stable across a known DST boundary (Australia/Sydney Mar 2026)", () => {
    // Australia's daylight saving ends first Sunday in April
    // 2026-04-05 is a Sunday; weekStart must return 2026-03-30 (Monday)
    expect(weekStart("2026-04-05")).toBe("2026-03-30");
    expect(weekStart("2026-04-06")).toBe("2026-04-06"); // Monday itself
  });
});

// ─── processEntries ──────────────────────────────────────────────────────────

describe("processEntries", () => {
  it("returns empty array for empty input", () => {
    expect(processEntries([])).toEqual([]);
  });

  it("applies the 4-hour minimum call", () => {
    const e = entry({ id: "1", date: "2026-05-18", startTime: "09:00", endTime: "10:00", hourlyRate: 50 });
    const [r] = processEntries([e]);
    expect(r.total).toBe(MIN_HOURS); // 1h worked → billed as 4h
    expect(r.totalEarnings).toBeCloseTo(50 * MIN_HOURS);
  });

  it("all hours are TFN when under the weekly limit", () => {
    const e = entry({ id: "1", date: "2026-05-18", startTime: "09:00", endTime: "17:00", hourlyRate: 50 });
    const [r] = processEntries([e], 30);
    expect(r.tfnPortion).toBeCloseTo(8);
    expect(r.abnPortion).toBeCloseTo(0);
    expect(r.tfnEarnings).toBeCloseTo(400);
    expect(r.abnEarnings).toBeCloseTo(0);
  });

  it("splits hours into TFN and ABN when the weekly limit is reached", () => {
    // 8h shift, tfnLimit = 5h → 5h TFN, 3h ABN
    const e = entry({ id: "1", date: "2026-05-18", startTime: "09:00", endTime: "17:00", hourlyRate: 50 });
    const [r] = processEntries([e], 5);
    expect(r.tfnPortion).toBeCloseTo(5);
    expect(r.abnPortion).toBeCloseTo(3);
    expect(r.tfnEarnings).toBeCloseTo(250);
    expect(r.abnEarnings).toBeCloseTo(150);
  });

  it("accumulates TFN budget across multiple entries in the same week", () => {
    const e1 = entry({ id: "1", date: "2026-05-18", startTime: "09:00", endTime: "17:00", hourlyRate: 50 }); // 8h
    const e2 = entry({ id: "2", date: "2026-05-19", startTime: "09:00", endTime: "17:00", hourlyRate: 50 }); // 8h
    const [r1, r2] = processEntries([e1, e2], 10); // limit = 10h
    expect(r1.tfnPortion).toBeCloseTo(8);
    expect(r1.abnPortion).toBeCloseTo(0);
    expect(r2.tfnPortion).toBeCloseTo(2); // 2 remaining from limit
    expect(r2.abnPortion).toBeCloseTo(6);
  });

  it("resets TFN budget on a new week", () => {
    // e1 is Mon May 18, e2 is Mon May 25 (new week)
    const e1 = entry({ id: "1", date: "2026-05-18", startTime: "09:00", endTime: "17:00", hourlyRate: 50 }); // 8h
    const e2 = entry({ id: "2", date: "2026-05-25", startTime: "09:00", endTime: "17:00", hourlyRate: 50 }); // 8h
    const [r1, r2] = processEntries([e1, e2], 10);
    expect(r1.tfnPortion).toBeCloseTo(8);
    expect(r2.tfnPortion).toBeCloseTo(8); // budget resets — both fully TFN
  });

  it("applies overtime above the threshold", () => {
    // 14h shift, overtimeThreshold = 12h → 12h regular, 2h OT
    const e = entry({ id: "1", date: "2026-05-18", startTime: "07:00", endTime: "21:00", hourlyRate: 50 });
    const [r] = processEntries([e], 30, undefined, 12);
    expect(r.overtime).toBeCloseTo(2);
    expect(r.regular).toBeCloseTo(12);
    // All TFN: (12h × $50) + (2h × $50 × 1.5) = $600 + $150 = $750
    expect(r.totalEarnings).toBeCloseTo(750);
  });

  it("correctly handles combined overtime and TFN/ABN split", () => {
    // 14h shift, tfnLimit = 10h, overtimeThreshold = 12h, rate = $50
    // regular = 12h, overtime = 2h
    // tfnPortion = 10h, abnPortion = 4h
    // rTFN  = min(12, 10) = 10h  → 10 × $50 = $500
    // otTFN = 0                  (overtime starts at hour 12, beyond tfn budget of 10)
    // rABN  = 12 - 10 = 2h       → 2 × $50  = $100
    // otABN = 2h                 → 2 × $75   = $150
    const e = entry({ id: "1", date: "2026-05-18", startTime: "07:00", endTime: "21:00", hourlyRate: 50 });
    const [r] = processEntries([e], 10, undefined, 12);
    expect(r.rTFN).toBeCloseTo(10);
    expect(r.otTFN).toBeCloseTo(0);
    expect(r.rABN).toBeCloseTo(2);
    expect(r.otABN).toBeCloseTo(2);
    expect(r.tfnEarnings).toBeCloseTo(500);
    expect(r.abnEarnings).toBeCloseTo(250);
    expect(r.totalEarnings).toBeCloseTo(750);
  });

  it("applies a separate TFN rate when provided", () => {
    const e = entry({ id: "1", date: "2026-05-18", startTime: "09:00", endTime: "17:00", hourlyRate: 50 });
    // 8h all TFN, tfnRate = 40
    const [r] = processEntries([e], 30, 40);
    expect(r.tfnEarnings).toBeCloseTo(8 * 40); // $320
    expect(r.abnEarnings).toBeCloseTo(0);
    expect(r.totalEarnings).toBeCloseTo(320);
  });

  it("deducts break minutes from worked hours", () => {
    const e = entry({ id: "1", date: "2026-05-18", startTime: "09:00", endTime: "17:00", hourlyRate: 50, breakMins: 60 });
    const [r] = processEntries([e], 30);
    expect(r.total).toBeCloseTo(7); // 8h - 1h break
    expect(r.totalEarnings).toBeCloseTo(7 * 50);
  });

  it("still applies the 4h minimum after break deduction", () => {
    // 5h shift with 4h break → 1h worked → billed as 4h
    const e = entry({ id: "1", date: "2026-05-18", startTime: "09:00", endTime: "14:00", hourlyRate: 50, breakMins: 240 });
    const [r] = processEntries([e], 30);
    expect(r.total).toBe(MIN_HOURS);
  });

  it("sorts entries by date then start time before processing", () => {
    // If entries were processed in submission order, the TFN budget would be
    // consumed by e2 first and e1 would spill to ABN — wrong.
    const e1 = entry({ id: "1", date: "2026-05-18", startTime: "09:00", endTime: "13:00", hourlyRate: 50 }); // Mon 4h
    const e2 = entry({ id: "2", date: "2026-05-19", startTime: "09:00", endTime: "13:00", hourlyRate: 50 }); // Tue 4h
    // Submitted in reverse order
    const results = processEntries([e2, e1], 4); // limit = 4h
    const r1 = results.find(r => r.id === "1")!;
    const r2 = results.find(r => r.id === "2")!;
    expect(r1.tfnPortion).toBeCloseTo(4); // Monday consumes the limit
    expect(r2.tfnPortion).toBeCloseTo(0); // Tuesday is all ABN
  });
});
