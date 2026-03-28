/** Parse one CSV line with optional quoted fields (RFC-style). */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && c === ",") {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

/** Non-empty lines → split rows (no multiline fields). */
export function splitCsvLines(text: string): string[] {
  return text.split(/\r?\n/).filter((l) => l.trim().length > 0);
}
