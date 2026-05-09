// Tiny CSV serialiser used by every card's "Export CSV" action.
// Triggers a browser download of `<filename>.csv` from the given columns/rows.

function escapeCell(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : String(v);
  // Quote if contains delimiter / quote / newline.
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(columns: string[], rows: unknown[][]): string {
  const header = columns.map(escapeCell).join(",");
  const body = rows
    .map((row) => row.map(escapeCell).join(","))
    .join("\n");
  return `${header}\n${body}\n`;
}

export function downloadCsv(filename: string, columns: string[], rows: unknown[][]): void {
  if (typeof window === "undefined") return;
  const csv = toCsv(columns, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Stamp a YYYYMMDD suffix on a base name (uses local time). */
export function stampedCsvName(base: string): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${base}-${y}${m}${day}.csv`;
}
