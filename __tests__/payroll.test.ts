import { describe, it, expect } from "vitest";
import { payday, nextPayday, payFortnight } from "@/lib/payroll";

describe("payday", () => {
  it("pays the fortnight ending the Sunday before on Thursday", () => {
    expect(payday("2026-09-14")).toBe("2026-10-01"); // first Monday
    expect(payday("2026-09-27")).toBe("2026-10-01"); // last Sunday
  });

  it("moves to the next payday on the following Monday", () => {
    expect(payday("2026-09-28")).toBe("2026-10-15");
  });

  it("works for fortnights before the anchor", () => {
    expect(payday("2026-09-13")).toBe("2026-09-17");
    expect(payday("2026-08-31")).toBe("2026-09-17");
    expect(payday("2026-08-30")).toBe("2026-09-03");
  });

  it("assigns work at the end of a month to the next month's payday", () => {
    // Fortnight 17–30 Aug is paid Thu 3 Sep, so it counts towards September.
    expect(payday("2026-08-30").slice(0, 7)).toBe("2026-09");
  });
});

describe("nextPayday", () => {
  it("is today on a payday", () => {
    expect(nextPayday("2026-10-01")).toBe("2026-10-01");
  });

  it("is the following payday otherwise", () => {
    expect(nextPayday("2026-10-02")).toBe("2026-10-15");
    expect(nextPayday("2026-10-14")).toBe("2026-10-15");
    expect(nextPayday("2026-09-18")).toBe("2026-10-01");
  });
});

describe("payFortnight", () => {
  it("covers the Mon–Sun fortnight ending the Sunday before", () => {
    expect(payFortnight("2026-10-01")).toEqual({ start: "2026-09-14", end: "2026-09-27" });
  });
});
