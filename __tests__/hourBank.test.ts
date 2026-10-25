import { describe, it, expect } from "vitest";
import { bankBalance } from "@/lib/hourBank";
import type { BankClosure } from "@/services/bankClosures";
import type { BankAdjustment } from "@/services/bankAdjustments";
import type { ProcessedEntry } from "@/types";

const closure = (weekStart: string, hours: number, mode: "abn" | "bank" = "bank") =>
  ({ id: weekStart, userId: "w", weekStart, weekEnd: weekStart, hours, createdAt: "", mode }) as BankClosure;
const adjustment = (hours: number) =>
  ({ id: String(hours), userId: "w", createdBy: "a", date: "2026-10-01", hours, note: "", createdAt: "" }) as BankAdjustment;
const entry = (bankHours: number, archived = false) =>
  ({ id: String(Math.random()), bankHours, archived }) as unknown as ProcessedEntry;

describe("bankBalance", () => {
  it("deducts payouts from closed and pending bank hours", () => {
    const b = bankBalance(
      [closure("2026-09-07", 5), closure("2026-09-14", 3)],
      [adjustment(-6)],
      [entry(2)],
    );
    expect(b).toEqual({ closed: 8, adjusted: -6, pending: 2, balance: 4 });
  });

  it("ignores ABN closures and archived entries", () => {
    const b = bankBalance([closure("2026-09-07", 4, "abn")], [adjustment(1.5)], [entry(3, true)]);
    expect(b.balance).toBe(1.5);
  });
});
