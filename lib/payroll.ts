// Workers are paid fortnightly on Thursdays (TFN and ABN alike). Each payday
// covers the Mon–Sun fortnight that ended the Sunday before it — e.g. Thu
// 1 Oct 2026 pays for work done Mon 14 Sep – Sun 27 Sep 2026.

const DAY_MS = 86_400_000;
// First Monday of a known pay fortnight; every other fortnight is a multiple
// of 14 days away from it.
const ANCHOR_FORTNIGHT_START = Date.UTC(2026, 8, 14); // Mon 14 Sep 2026
// Monday the fortnight starts → Thursday it is paid (Sun + 4 days).
const PAYDAY_OFFSET_DAYS = 17;

function toUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function toDateStr(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// The Thursday on which work done on `date` (YYYY-MM-DD) is paid.
export function payday(date: string): string {
  const days = Math.round((toUtc(date) - ANCHOR_FORTNIGHT_START) / DAY_MS);
  const fortnight = Math.floor(days / 14);
  return toDateStr(ANCHOR_FORTNIGHT_START + (fortnight * 14 + PAYDAY_OFFSET_DAYS) * DAY_MS);
}
