"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ReorderMetric = {
  sku_id: string;
  description: string | null;
  current_qty: number;
  expected_qty: number;
  available_qty: number;
  sold_30d: number;
  min_reorder_qty: number;
  lead_time_days: number;
  use_advanced: boolean;
  is_below_reorder: boolean;
};

type PageData = {
  total: number;
  page: number;
  limit: number;
  data: ReorderMetric[];
};

type ConfigDraft = { lead_time_days: string; use_advanced: boolean };

// ── Helpers ──────────────────────────────────────────────────────────────────

function formulaLabel(m: ReorderMetric): string {
  if (m.use_advanced) {
    return `(${m.sold_30d} / 30) × ${m.lead_time_days}d LT`;
  }
  return `30d sales`;
}

function qtyBadge(qty: number, min: number) {
  if (qty === 0) {
    return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">0</Badge>;
  }
  if (qty < min) {
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">{qty}</Badge>;
  }
  return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">{qty}</Badge>;
}

function alertBadge(isBelowReorder: boolean) {
  if (isBelowReorder) {
    return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Alert</Badge>;
  }
  return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">OK</Badge>;
}

// ── Config editor cell ────────────────────────────────────────────────────────

function ConfigCell({
  metric,
  onSaved,
}: {
  metric: ReorderMetric;
  onSaved: (updated: ReorderMetric) => void;
}) {
  const [draft, setDraft] = React.useState<ConfigDraft>({
    lead_time_days: String(metric.lead_time_days),
    use_advanced: metric.use_advanced,
  });
  const [saving, setSaving] = React.useState(false);

  function handleLeadTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDraft(d => ({ ...d, lead_time_days: e.target.value }));
  }

  function handleFormulaChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setDraft(d => ({ ...d, use_advanced: e.target.value === "advanced" }));
  }

  async function save() {
    const lt = Number(draft.lead_time_days);
    if (!Number.isInteger(lt) || lt < 1 || lt > 365) {
      toast.error("Lead time must be 1–365 days");
      return;
    }
    setSaving(true);
    try {
      const updated = await apiFetch<ReorderMetric>(
        `/api/reorder/config/${encodeURIComponent(metric.sku_id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead_time_days: lt, use_advanced: draft.use_advanced }),
        }
      );
      toast.success("Config saved");
      onSaved({ ...metric, ...updated });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={1}
        max={365}
        value={draft.lead_time_days}
        onChange={handleLeadTimeChange}
        className="h-7 w-16 text-xs"
      />
      <select
        value={draft.use_advanced ? "advanced" : "simple"}
        onChange={handleFormulaChange}
        className="h-7 rounded border border-input bg-background px-1.5 text-xs"
      >
        <option value="simple">Simple</option>
        <option value="advanced">Advanced</option>
      </select>
      <Button size="sm" className="h-7 px-2 text-xs" disabled={saving} onClick={save}>
        {saving ? "…" : "Save"}
      </Button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReorderPage() {
  const [keyword, setKeyword] = React.useState("");
  const [appliedKeyword, setAppliedKeyword] = React.useState("");
  const [alertsOnly, setAlertsOnly] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [pageData, setPageData] = React.useState<PageData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: "50" });
      if (appliedKeyword.trim()) q.set("keyword", appliedKeyword.trim());
      if (alertsOnly) q.set("alerts_only", "true");
      const data = await apiFetch<PageData>(`/api/reorder/metrics?${q}`);
      setPageData(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
      setPageData(null);
    } finally {
      setLoading(false);
    }
  }, [page, appliedKeyword, alertsOnly]);

  React.useEffect(() => { void load(); }, [load]);

  function handleApply() {
    setAppliedKeyword(keyword);
    setPage(1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleApply();
  }

  function handleAlertToggle() {
    setAlertsOnly(v => !v);
    setPage(1);
  }

  function handleMetricUpdated(updated: ReorderMetric) {
    setPageData(prev => {
      if (!prev) return prev;
      return { ...prev, data: prev.data.map(m => m.sku_id === updated.sku_id ? updated : m) };
    });
  }

  const alertCount = pageData?.data.filter(m => m.is_below_reorder).length ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Reorder Alerts</h1>
          <p className="text-sm text-muted-foreground">
            SKUs where available qty (current + expected) falls below the reorder threshold.
          </p>
        </div>
        {pageData && alertCount > 0 && (
          <Badge className="mt-1 shrink-0 bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-sm px-3 py-1">
            {alertCount} alert{alertCount !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search SKU / description…"
          className="h-9 w-56 text-sm"
        />
        <Button className="h-9" onClick={handleApply}>Search</Button>
        <Button
          variant={alertsOnly ? "default" : "outline"}
          className="h-9"
          onClick={handleAlertToggle}
        >
          {alertsOnly ? "Showing alerts only" : "Show alerts only"}
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead className="font-mono">SKU</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">Expected</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Min Reorder</TableHead>
              <TableHead className="text-right">30d Sales</TableHead>
              <TableHead>Formula</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Config (LT · Formula)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : !pageData?.data.length
              ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center text-sm text-muted-foreground">
                    {alertsOnly ? "No reorder alerts. All SKUs are above threshold." : "No SKUs found."}
                  </TableCell>
                </TableRow>
              )
              : pageData.data.map(m => (
                  <TableRow
                    key={m.sku_id}
                    className={m.is_below_reorder ? "bg-red-50/40 hover:bg-red-50/60" : undefined}
                  >
                    <TableCell className="font-mono text-xs font-semibold text-primary">
                      {m.sku_id}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {m.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.current_qty}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{m.expected_qty}</TableCell>
                    <TableCell className="text-right">
                      {qtyBadge(m.available_qty, m.min_reorder_qty)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{m.min_reorder_qty}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{m.sold_30d}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formulaLabel(m)}</TableCell>
                    <TableCell>{alertBadge(m.is_below_reorder)}</TableCell>
                    <TableCell>
                      <ConfigCell metric={m} onSaved={handleMetricUpdated} />
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>

        {!loading && (pageData?.data.length ?? 0) > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-xs text-muted-foreground">
              {pageData?.total ?? 0} total SKUs
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(pageData?.data.length ?? 0) < 50}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
