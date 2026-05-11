"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch, apiUrl, getStoredToken } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function downloadBlob(path: string, body: unknown, filename: string) {
  const headers = new Headers({ "Content-Type": "application/json" });
  const token = getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(apiUrl(path), { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const t = await res.text();
    let msg = t || res.statusText;
    try { const j = JSON.parse(t) as { error?: string }; if (j.error) msg = j.error; } catch { /* plain */ }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Domain types ─────────────────────────────────────────────────────────────

type BinAllocation = { bin_id: string; qty: number; available_qty: number };
type SkuSuggestion = {
  sku_id: string;
  description: string | null;
  required_qty: number;
  total_available: number;
  allocated_qty: number;
  shortfall: number;
  bins: BinAllocation[];
};
type SuggestResult = { suggestions: SkuSuggestion[]; fully_allocatable: boolean };
type CommitBinResult = { bin_id: string; deducted: number; new_qty: number };
type CommitSkuResult = { sku_id: string; total_deducted: number; bins: CommitBinResult[] };

// ── Local UI types ────────────────────────────────────────────────────────────

type InputRow = { id: string; sku_id: string; required_qty: string };
type OverrideMap = Map<string, Map<string, number>>; // sku_id → bin_id → qty

// ── Helpers ──────────────────────────────────────────────────────────────────

let rowCounter = 0;
function newRow(): InputRow {
  rowCounter += 1;
  return { id: String(rowCounter), sku_id: "", required_qty: "" };
}

function validateInputRows(rows: InputRow[]): string | null {
  const filled = rows.filter(r => r.sku_id.trim());
  if (filled.length === 0) { return "Add at least one SKU."; }
  for (const r of filled) {
    const qty = Number(r.required_qty);
    if (!Number.isInteger(qty) || qty < 1) {
      return `Required qty for "${r.sku_id}" must be a positive integer.`;
    }
  }
  return null;
}

function getOverrideQty(overrides: OverrideMap, skuId: string, binId: string, fallback: number): number {
  return overrides.get(skuId)?.get(binId) ?? fallback;
}

function calcSkuTotal(suggestion: SkuSuggestion, overrides: OverrideMap): number {
  return suggestion.bins.reduce(
    (sum, b) => sum + getOverrideQty(overrides, suggestion.sku_id, b.bin_id, b.qty),
    0
  );
}

function buildCommitItems(suggestions: SkuSuggestion[], overrides: OverrideMap) {
  return suggestions.map(s => ({
    sku_id: s.sku_id,
    bin_allocations: s.bins.map(b => ({
      bin_id: b.bin_id,
      qty: getOverrideQty(overrides, s.sku_id, b.bin_id, b.qty),
    })),
  }));
}

function shortfallBadge(shortfall: number, required: number) {
  if (shortfall === 0) {
    return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Fully allocatable</Badge>;
  }
  return (
    <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
      Short {shortfall} / {required}
    </Badge>
  );
}

// ── Phase components ──────────────────────────────────────────────────────────

function InputPhase({
  rows,
  loading,
  onChange,
  onAddRow,
  onRemoveRow,
  onSuggest,
  onCsvUpload,
}: Readonly<{
  rows: InputRow[];
  loading: boolean;
  onChange: (id: string, field: "sku_id" | "required_qty", value: string) => void;
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onSuggest: () => void;
  onCsvUpload: (file: File) => void;
}>) {
  const csvRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="grid grid-cols-[1fr_120px_36px] gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
          <span>SKU ID</span><span>Required Qty</span><span />
        </div>
        {rows.map(row => (
          <div key={row.id} className="grid grid-cols-[1fr_120px_36px] gap-2 items-center">
            <Input
              value={row.sku_id}
              onChange={e => onChange(row.id, "sku_id", e.target.value)}
              placeholder="e.g. SKU-001"
              className="h-9 font-mono text-sm"
            />
            <Input
              type="number"
              min={1}
              value={row.required_qty}
              onChange={e => onChange(row.id, "required_qty", e.target.value)}
              placeholder="Qty"
              className="h-9 text-sm"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
              disabled={rows.length <= 1}
              onClick={() => onRemoveRow(row.id)}
            >
              ×
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={onAddRow}>+ Add SKU</Button>
      </div>

      <div className="flex items-center gap-3">
        <Button className="min-h-10" disabled={loading} onClick={onSuggest}>
          {loading ? "Loading…" : "Get suggestions →"}
        </Button>
        <span className="text-muted-foreground text-xs">or</span>
        <input
          ref={csvRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="sr-only"
          disabled={loading}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) { onCsvUpload(f); e.target.value = ""; }
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="min-h-10"
          disabled={loading}
          onClick={() => csvRef.current?.click()}
        >
          Upload CSV
        </Button>
        <Link
          href="/samples/bins/sample_outward.csv"
          download="sample_outward.csv"
          className="text-xs text-primary underline-offset-2 hover:underline"
        >
          Sample CSV
        </Link>
      </div>
    </div>
  );
}

function BinOverrideRow({
  bin,
  skuId,
  overrides,
  onOverride,
}: Readonly<{
  bin: BinAllocation;
  skuId: string;
  overrides: OverrideMap;
  onOverride: (skuId: string, binId: string, qty: number) => void;
}>) {
  const currentQty = getOverrideQty(overrides, skuId, bin.bin_id, bin.qty);
  const isOverridden = overrides.get(skuId)?.has(bin.bin_id) ?? false;

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="font-mono text-muted-foreground w-32 shrink-0">{bin.bin_id}</span>
      <span className="text-xs text-muted-foreground">avail: {bin.available_qty}</span>
      <div className="flex items-center gap-2 ml-auto">
        {isOverridden && (
          <span className="text-xs text-amber-600 font-medium">override</span>
        )}
        <Input
          type="number"
          min={0}
          max={bin.available_qty}
          value={currentQty}
          onChange={e => {
            const v = Math.min(bin.available_qty, Math.max(0, Number(e.target.value)));
            onOverride(skuId, bin.bin_id, v);
          }}
          className="h-7 w-20 text-sm text-right"
        />
      </div>
    </div>
  );
}

function SkuReviewCard({
  suggestion,
  overrides,
  onOverride,
}: Readonly<{
  suggestion: SkuSuggestion;
  overrides: OverrideMap;
  onOverride: (skuId: string, binId: string, qty: number) => void;
}>) {
  const total = calcSkuTotal(suggestion, overrides);
  const isShort = total < suggestion.required_qty;

  return (
    <div className={`rounded-lg border bg-white p-4 space-y-3 ${isShort ? "border-amber-300" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-bold text-primary">{suggestion.sku_id}</p>
          {suggestion.description ? (
            <p className="text-xs text-muted-foreground mt-0.5">{suggestion.description}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {shortfallBadge(suggestion.shortfall, suggestion.required_qty)}
          <span className="text-xs text-muted-foreground">
            {total} / {suggestion.required_qty} allocated
          </span>
        </div>
      </div>
      <div className="space-y-2 border-t pt-3">
        {suggestion.bins.length === 0 ? (
          <p className="text-xs text-red-600">No stock available in any bin.</p>
        ) : suggestion.bins.map(bin => (
          <BinOverrideRow
            key={bin.bin_id}
            bin={bin}
            skuId={suggestion.sku_id}
            overrides={overrides}
            onOverride={onOverride}
          />
        ))}
      </div>
    </div>
  );
}

function ReviewPhase({
  suggestions,
  overrides,
  loading,
  onOverride,
  onBack,
  onCommit,
}: Readonly<{
  suggestions: SkuSuggestion[];
  overrides: OverrideMap;
  loading: boolean;
  onOverride: (skuId: string, binId: string, qty: number) => void;
  onBack: () => void;
  onCommit: () => void;
}>) {
  const anyShort = suggestions.some(s => calcSkuTotal(s, overrides) < s.required_qty);

  return (
    <div className="space-y-4">
      {anyShort && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Some SKUs cannot be fully allocated. You may proceed with partial allocation or adjust quantities.
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {suggestions.map(s => (
          <SkuReviewCard
            key={s.sku_id}
            suggestion={s}
            overrides={overrides}
            onOverride={onOverride}
          />
        ))}
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack}>← Back</Button>
        <Button className="min-h-10" disabled={loading} onClick={onCommit}>
          {loading ? "Committing…" : "Commit allocation"}
        </Button>
      </div>
    </div>
  );
}

function DonePhase({
  results,
  suggestions,
  committedAt,
  onReset,
}: Readonly<{
  results: CommitSkuResult[];
  suggestions: SkuSuggestion[];
  committedAt: string;
  onReset: () => void;
}>) {
  const [downloading, setDownloading] = React.useState(false);
  const totalDeducted = results.reduce((s, r) => s + r.total_deducted, 0);
  const descriptions = Object.fromEntries(suggestions.map(s => [s.sku_id, s.description ?? ""]));

  async function handleDownload() {
    setDownloading(true);
    try {
      const slug = committedAt.slice(0, 16).replaceAll("T", "-").replaceAll(":", "-");
      await downloadBlob(
        "/api/bins/outward/changes-export",
        { committed_at: committedAt, results, descriptions },
        `bin-changes-${slug}.xlsx`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3">
        <p className="text-sm font-semibold text-green-800">
          Allocation committed — {results.length} SKU{results.length !== 1 ? "s" : ""}, {totalDeducted} units total
        </p>
      </div>
      <div className="rounded-lg border bg-card overflow-hidden print-results">
        {results.map((r, i) => (
          <div key={r.sku_id} className={`p-4 space-y-2 ${i < results.length - 1 ? "border-b" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-bold text-primary">{r.sku_id}</span>
              <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                −{r.total_deducted} units
              </Badge>
            </div>
            {descriptions[r.sku_id] ? (
              <p className="text-xs text-muted-foreground">{descriptions[r.sku_id]}</p>
            ) : null}
            <div className="space-y-1">
              {r.bins.map(b => (
                <div key={b.bin_id} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">{b.bin_id}</span>
                  <span>prev {b.new_qty + b.deducted} → deducted {b.deducted} → remaining {b.new_qty}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 print:hidden">
        <Button onClick={onReset} variant="outline">New outward</Button>
        <Button onClick={() => void handleDownload()} disabled={downloading}>
          {downloading ? "Downloading…" : "Download Excel"}
        </Button>
        <Button variant="outline" onClick={() => globalThis.print()}>Print</Button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Phase = "input" | "review" | "done";

export default function BulkOutwardPage() {
  const [phase, setPhase] = React.useState<Phase>("input");
  const [rows, setRows] = React.useState<InputRow[]>([newRow()]);
  const [suggestions, setSuggestions] = React.useState<SkuSuggestion[]>([]);
  const [overrides, setOverrides] = React.useState<OverrideMap>(new Map());
  const [commitResults, setCommitResults] = React.useState<CommitSkuResult[]>([]);
  const [committedAt, setCommittedAt] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  function handleRowChange(id: string, field: "sku_id" | "required_qty", value: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  function handleAddRow() {
    setRows(prev => [...prev, newRow()]);
  }

  function handleRemoveRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id));
  }

  function handleOverride(skuId: string, binId: string, qty: number) {
    setOverrides(prev => {
      const next = new Map(prev);
      const skuMap = new Map(next.get(skuId) ?? []);
      skuMap.set(binId, qty);
      next.set(skuId, skuMap);
      return next;
    });
  }

  async function handleSuggest() {
    const err = validateInputRows(rows);
    if (err) { toast.error(err); return; }

    const items = rows
      .filter(r => r.sku_id.trim())
      .map(r => ({ sku_id: r.sku_id.trim(), required_qty: Number(r.required_qty) }));

    setLoading(true);
    try {
      const result = await apiFetch<SuggestResult>("/api/bins/outward/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      setSuggestions(result.suggestions);
      setOverrides(new Map());
      setPhase("review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to get suggestions");
    } finally {
      setLoading(false);
    }
  }

  async function handleCsvUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    setLoading(true);
    try {
      const result = await apiFetch<{ items: { sku_id: string; required_qty: number }[]; errors: { row: number; message: string }[] }>(
        "/api/bins/outward/parse-csv",
        { method: "POST", body: fd }
      );
      if (result.errors.length > 0) {
        const preview = result.errors.slice(0, 4).map(e => `Row ${e.row}: ${e.message}`).join("\n");
        toast.warning(`Parsed ${result.items.length} rows; ${result.errors.length} error(s)`, { description: preview + (result.errors.length > 4 ? "\n…" : "") });
      }
      if (result.items.length === 0) { setLoading(false); return; }
      const newRows: InputRow[] = result.items.map(item => {
        rowCounter += 1;
        return { id: String(rowCounter), sku_id: item.sku_id, required_qty: String(item.required_qty) };
      });
      setRows(newRows);
      // Auto-proceed to suggest
      const items = newRows.map(r => ({ sku_id: r.sku_id.trim(), required_qty: Number(r.required_qty) }));
      const suggestion = await apiFetch<SuggestResult>("/api/bins/outward/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      setSuggestions(suggestion.suggestions);
      setOverrides(new Map());
      setPhase("review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "CSV upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    const commitItems = buildCommitItems(suggestions, overrides);
    setLoading(true);
    try {
      const result = await apiFetch<{ results: CommitSkuResult[] }>("/api/bins/outward/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: commitItems }),
      });
      setCommitResults(result.results);
      setCommittedAt(new Date().toISOString());
      setPhase("done");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Commit failed");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setRows([newRow()]);
    setSuggestions([]);
    setOverrides(new Map());
    setCommitResults([]);
    setCommittedAt("");
    setPhase("input");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bulk Outward</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter SKUs and required quantities. The system suggests which bins to draw from, and
          commits all deductions in a single transaction.
        </p>
      </div>

      <div className="flex gap-3 text-sm">
        {(["input", "review", "done"] as Phase[]).map((p, i) => (
          <React.Fragment key={p}>
            <span className={phase === p ? "font-semibold text-foreground" : "text-muted-foreground"}>
              {i + 1}. {p.charAt(0).toUpperCase() + p.slice(1)}
            </span>
            {i < 2 && <span className="text-muted-foreground">→</span>}
          </React.Fragment>
        ))}
      </div>

      {phase === "input" && (
        <InputPhase
          rows={rows}
          loading={loading}
          onChange={handleRowChange}
          onAddRow={handleAddRow}
          onRemoveRow={handleRemoveRow}
          onSuggest={handleSuggest}
          onCsvUpload={handleCsvUpload}
        />
      )}
      {phase === "review" && (
        <ReviewPhase
          suggestions={suggestions}
          overrides={overrides}
          loading={loading}
          onOverride={handleOverride}
          onBack={() => setPhase("input")}
          onCommit={handleCommit}
        />
      )}
      {phase === "done" && (
        <DonePhase
          results={commitResults}
          suggestions={suggestions}
          committedAt={committedAt}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
