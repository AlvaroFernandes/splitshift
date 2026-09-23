// Australian resident individual income tax — FY2026-27 rates (the 18,201–
// 45,000 bracket drops from 16% to 15% under the legislated "Cost of Living
// Tax Cuts Round 2", effective 1 July 2026). Assumes the tax-free threshold
// is claimed (the normal case for a worker's only job) and ignores HECS/HELP
// repayments. These are estimates for planning purposes, not a payslip —
// revisit whenever the ATO updates brackets or the Medicare thresholds.
const TAX_BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 18_200,   rate: 0    },
  { upTo: 45_000,   rate: 0.15 },
  { upTo: 135_000,  rate: 0.30 },
  { upTo: 190_000,  rate: 0.37 },
  { upTo: Infinity, rate: 0.45 },
];

function incomeTax(annualIncome: number): number {
  let tax = 0;
  let lastThreshold = 0;
  for (const { upTo, rate } of TAX_BRACKETS) {
    if (annualIncome <= lastThreshold) break;
    tax += (Math.min(annualIncome, upTo) - lastThreshold) * rate;
    lastThreshold = upTo;
  }
  return tax;
}

// Medicare levy: 2% flat above the low-income threshold, shaded in at 10c
// per dollar between the threshold and the point where that reaches the
// full 2% — single, no dependents (last indexed for FY2024-25; the ATO
// re-indexes this most years).
const MEDICARE_LOW_THRESHOLD = 27_222;
const MEDICARE_RATE = 0.02;
const MEDICARE_SHADE_RATE = 0.10;
const MEDICARE_SHADE_CEILING = MEDICARE_LOW_THRESHOLD * (MEDICARE_SHADE_RATE / (MEDICARE_SHADE_RATE - MEDICARE_RATE));

function medicareLevy(annualIncome: number): number {
  if (annualIncome <= MEDICARE_LOW_THRESHOLD) return 0;
  if (annualIncome <= MEDICARE_SHADE_CEILING) return (annualIncome - MEDICARE_LOW_THRESHOLD) * MEDICARE_SHADE_RATE;
  return annualIncome * MEDICARE_RATE;
}

export interface NetEstimate {
  gross: number;
  tax: number;
  medicareLevy: number;
  net: number;
  effectiveRate: number; // (tax + levy) / gross
}

// Estimates net pay for one pay period by annualising its gross — the same
// approach payroll software uses to decide how much to withhold each pay
// run: assume this rate of pay continues for a full year, work out the
// full-year tax + Medicare levy, then scale that rate back down to the
// period. Accurate as long as the period's gross is representative of the
// worker's ongoing pay (true here since TFN pay is a fixed weekly salary).
export function estimateNetForPeriod(periodGross: number, periodsPerYear: number): NetEstimate {
  if (periodGross <= 0) {
    return { gross: periodGross, tax: 0, medicareLevy: 0, net: periodGross, effectiveRate: 0 };
  }
  const annualGross = periodGross * periodsPerYear;
  const annualTax   = incomeTax(annualGross);
  const annualLevy  = medicareLevy(annualGross);
  const tax  = periodGross * (annualTax  / annualGross);
  const levy = periodGross * (annualLevy / annualGross);
  return { gross: periodGross, tax, medicareLevy: levy, net: periodGross - tax - levy, effectiveRate: (annualTax + annualLevy) / annualGross };
}
