// IST display helpers. Internal data uses UTC ISO strings; the UI converts at
// the edge so dashboards always show India Standard Time / en-IN locale.

const IST_LOCALE = "en-IN";
const IST_TZ = "Asia/Kolkata";

function parseDayParts(day: string): [number, number, number] {
  // "YYYY-MM-DD" → [y, m, d]. Treat as a calendar date, no timezone shifting.
  const [y, m, d] = day.split("-").map(Number);
  return [y, m, d];
}

/** "8 May" — short calendar-day label for chart axes. */
export function formatIstShortDay(day: string): string {
  const [y, m, d] = parseDayParts(day);
  return new Intl.DateTimeFormat(IST_LOCALE, {
    day: "numeric",
    month: "short",
  }).format(new Date(y, m - 1, d));
}

/** "8 May 2026" — full calendar date for ranges and labels. */
export function formatIstDate(day: string): string {
  const [y, m, d] = parseDayParts(day);
  return new Intl.DateTimeFormat(IST_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

/** Subtract one calendar day from a YYYY-MM-DD string. */
export function previousDay(day: string): string {
  const [y, m, d] = parseDayParts(day);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/** "9 Apr 2026 – 8 May 2026" — inclusive end (caller passes exclusive upper bound). */
export function formatIstRangeInclusive(from: string, toExclusive: string): string {
  return `${formatIstDate(from)} – ${formatIstDate(previousDay(toExclusive))}`;
}

/**
 * Format a moment (Date or ISO timestamp) in IST as "8 May 2026, 14:30".
 * Use for true timestamps (created_at, etc.), NOT for calendar-day strings.
 */
export function formatIstDateTime(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(IST_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: IST_TZ,
    hourCycle: "h23",
  }).format(d);
}

/** True if a string looks like a YYYY-MM-DD calendar day. */
export function looksLikeIsoDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** True if a string looks like a full ISO 8601 timestamp. */
export function looksLikeIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)
  );
}
