#!/usr/bin/env node
/**
 * Extract sync warnings/errors from log files for client-facing documentation.
 *
 * Usage:
 *   node scripts/harvest-sync-warnings.mjs <log-file> [log-file...]
 *   node scripts/harvest-sync-warnings.mjs <log-file> --append
 *
 * Writes a markdown snippet to stdout. With --append, appends a dated section to
 * docs/operations/prod-supabase-migration-sync-warnings.md (review git diff before commit).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WARNINGS_DOC = path.join(
  __dirname,
  "../docs/operations/prod-supabase-migration-sync-warnings.md"
);

const PATTERNS = [
  {
    kind: "orchestrator",
    re: /WARNING:\s+npm run ([^\s]+) exited (\d+)/g,
    format: (m) => `Orchestrator: \`${m[1]}\` exited ${m[2]}`,
  },
  {
    kind: "vendor",
    re: /Vendor (\d+) failed: (.+)/g,
    format: (m) => `Vendor ${m[1]} failed: ${m[2]}`,
  },
  {
    kind: "warehouse",
    re: /Warehouse ingest \(listings\/pack_combos\) ([^:]+): (.+)/g,
    format: (m) => `Warehouse ingest SKU \`${m[1].trim()}\`: ${m[2].trim()}`,
  },
  {
    kind: "row",
    re: /^Row ([^:]+): (.+)$/gm,
    format: (m) => `Row \`${m[1].trim()}\`: ${m[2].trim()}`,
  },
  {
    kind: "skip",
    re: /Skip row: ([^\s]+)\s+(.+)/g,
    format: (m) => `Skip row (${m[1]}): ${m[2].trim()}`,
  },
  {
    kind: "get_fallback",
    re: /GET fallback(?: \(POST failed\))? ([^:]+):/g,
    format: (m) => `GET fallback (POST failed): \`${m[1].trim()}\``,
  },
  {
    kind: "network",
    re: /Error: (?:read )?(EHOSTUNREACH|ENOTFOUND|EMAXCONNSESSION[^\n]*)/g,
    format: (m) => `Network/infra: ${m[1].trim()}`,
  },
  {
    kind: "verify",
    re: /\[verify-[^\]]+\] Error: (.+)/g,
    format: (m) => `Verify script: ${m[1].trim()}`,
  },
];

function harvest(text, sourceLabel) {
  const entries = [];
  for (const { kind, re, format } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      entries.push({ kind, text: format(m), source: sourceLabel });
    }
  }
  return entries;
}

function dedupe(entries) {
  const seen = new Set();
  return entries.filter((e) => {
    const k = `${e.kind}|${e.text}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function summarizeByKind(entries) {
  const counts = {};
  for (const e of entries) {
    counts[e.kind] = (counts[e.kind] || 0) + 1;
  }
  return counts;
}

function toMarkdown(entries, sources) {
  const now = new Date().toISOString();
  const counts = summarizeByKind(entries);
  const lines = [
    `### Harvest — ${now}`,
    "",
    `**Sources:** ${sources.join(", ")}`,
    "",
    "**Counts by kind:**",
    "",
  ];
  for (const [k, n] of Object.entries(counts).sort()) {
    lines.push(`- ${k}: ${n}`);
  }
  lines.push("", "**Entries:**", "");
  if (entries.length === 0) {
    lines.push("_No warnings matched._");
  } else {
    for (const e of entries) {
      lines.push(`- ${e.text}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function main() {
  const argv = process.argv.slice(2);
  const append = argv.includes("--append");
  const files = argv.filter((a) => a !== "--append");
  if (files.length === 0) {
    console.error(
      "Usage: node scripts/harvest-sync-warnings.mjs <log-file> [log-file...] [--append]"
    );
    process.exit(1);
  }

  let all = [];
  const sources = [];
  for (const f of files) {
    const abs = path.resolve(f);
    if (!fs.existsSync(abs)) {
      console.error(`File not found: ${abs}`);
      process.exit(1);
    }
    const text = fs.readFileSync(abs, "utf8");
    const label = path.basename(abs);
    sources.push(label);
    all = all.concat(harvest(text, label));
  }
  all = dedupe(all);
  const md = toMarkdown(all, sources);
  console.log(md);

  if (append) {
    const block = `\n---\n\n${md}\n`;
    fs.appendFileSync(WARNINGS_DOC, block, "utf8");
    console.error(`Appended to ${WARNINGS_DOC}`);
  }
}

main();
