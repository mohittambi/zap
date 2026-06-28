/** Shared date-range helpers for Operations overview (client + server safe). */

export const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type SummaryDateRange = { from: string; to: string };

export function isIsoDay(value: string): boolean {
  return ISO_DAY_RE.test(value);
}

export function utcTodayIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

export function parseIsoDayUtc(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addUtcDays(day: string, delta: number): string {
  const dt = parseIsoDayUtc(day);
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/** Trailing N calendar days ending today (exclusive `to` = start of UTC today). */
export function computePresetRange(days: number, now = new Date()): SummaryDateRange {
  const to = utcTodayIso(now);
  const from = addUtcDays(to, -days);
  return { from, to };
}

export function defaultSummaryRange(now = new Date()): SummaryDateRange {
  return computePresetRange(30, now);
}

export const SUMMARY_PRESET_DAYS = [7, 30, 90, 365] as const;
export type SummaryPresetDays = (typeof SUMMARY_PRESET_DAYS)[number];

export function detectPreset(
  from: string,
  to: string,
  now = new Date()
): SummaryPresetDays | "custom" {
  for (const days of SUMMARY_PRESET_DAYS) {
    const r = computePresetRange(days, now);
    if (r.from === from && r.to === to) return days;
  }
  return "custom";
}

/** Inclusive end date for `<input type="date">` (API `to` is exclusive). */
export function inclusiveEndFromExclusive(toExclusive: string): string {
  return addUtcDays(toExclusive, -1);
}

export function exclusiveEndFromInclusive(toInclusive: string): string {
  return addUtcDays(toInclusive, 1);
}
