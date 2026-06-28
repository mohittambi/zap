"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { useAuth } from "@/contexts/auth-context";
import { InsightsShell } from "@/components/insights/insights-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Insight = {
  insight_key: string;
  domain: string;
  severity: string;
  title: string;
  rationale: string;
  recommended_action: string;
  impact_value: number;
  priority: number;
  entity?: { type: string; id: string };
};

type Summary = {
  home_kpis: {
    sales_qty: { value: number; delta_mom_pct: number | null };
    fill_rate_pct: { value: number; delta_mom_pct: number | null };
    inbound_qty: { value: number };
    gmv_value_30d: { value: number };
  };
  ops_queues: {
    audit_pending: number;
    invoice_collection_pending: number;
    debit_credit_notes_pending: number;
  };
  insight_counts: {
    total: number;
    by_domain: Record<string, number>;
    by_severity: Record<string, number>;
  };
};

type SnapshotRow = {
  id: number;
  generated_at: string;
  trigger: string;
  summary: { total?: number };
};

function severityBadge(severity: string) {
  if (severity === "CRITICAL") {
    return <Badge variant="destructive">Critical</Badge>;
  }
  if (severity === "WARNING") {
    return (
      <Badge className="border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100">
        Warning
      </Badge>
    );
  }
  return <Badge variant="secondary">Info</Badge>;
}

function entityLink(entity?: { type: string; id: string }) {
  if (!entity) return null;
  if (entity.type === "SKU") {
    return (
      <Link href={`/listings/${encodeURIComponent(entity.id)}`} className="text-primary text-xs hover:underline">
        {entity.id}
      </Link>
    );
  }
  if (entity.type === "VENDOR" && entity.id !== "aggregate") {
    return (
      <Link href={`/inbound/vendors/${entity.id}`} className="text-primary text-xs hover:underline">
        Vendor {entity.id}
      </Link>
    );
  }
  return <span className="font-mono text-xs">{entity.id}</span>;
}

export default function InsightsOverviewPage() {
  const { isAdmin } = useAuth();
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [insights, setInsights] = React.useState<Insight[]>([]);
  const [snapshots, setSnapshots] = React.useState<SnapshotRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [confirmFeedback, setConfirmFeedback] = React.useState<{
    insight: Insight;
    action: "DISMISSED" | "SNOOZED";
  } | null>(null);
  const [snoozeDays, setSnoozeDays] = React.useState("7");
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = search.trim() ? `&search_keyword=${encodeURIComponent(search.trim())}` : "";
      const [sum, list, snaps] = await Promise.all([
        apiFetch<Summary>("/api/insights/summary"),
        apiFetch<{ content: Insight[] }>(`/api/insights?page=1&count=100${q}`),
        apiFetch<{ content: SnapshotRow[] }>("/api/insights/snapshots?page=1&count=5"),
      ]);
      setSummary(sum);
      setInsights(list.content ?? []);
      setSnapshots(snaps.content ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function submitFeedback() {
    if (!confirmFeedback) return;
    setSubmitting(true);
    try {
      const snooze_until =
        confirmFeedback.action === "SNOOZED"
          ? new Date(Date.now() + Number(snoozeDays) * 86400000)
              .toISOString()
              .slice(0, 10)
          : undefined;
      await apiFetch("/api/insights/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insight_key: confirmFeedback.insight.insight_key,
          action: confirmFeedback.action,
          snooze_until,
        }),
      });
      toast.success(
        confirmFeedback.action === "DISMISSED" ? "Insight dismissed" : "Insight snoozed"
      );
      setConfirmFeedback(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function runDigest() {
    try {
      const r = await apiFetch<{ snapshot_id: number }>("/api/insights/digest", {
        method: "POST",
      });
      toast.success(`Digest saved (snapshot #${r.snapshot_id})`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Digest failed");
    }
  }

  if (!isAdmin) {
    return (
      <InsightsShell title="Insights" description="Admin access required.">
        <p className="text-muted-foreground text-sm">You do not have permission to view this hub.</p>
      </InsightsShell>
    );
  }

  return (
    <InsightsShell
      title="Decision Intelligence"
      description="Ranked recommendations across inventory, procurement, and sales."
    >
      {loading && !summary ? (
        <Skeleton className="h-40 w-full" />
      ) : summary ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Open insights</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{summary.insight_counts.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Sales (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{summary.home_kpis.sales_qty.value}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Fill rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {summary.home_kpis.fill_rate_pct.value.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Queue backlog</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {summary.ops_queues.audit_pending +
                  summary.ops_queues.invoice_collection_pending +
                  summary.ops_queues.debit_credit_notes_pending}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="flex-1 sm:max-w-xs">
          <Label htmlFor="insight-search" className="text-xs">
            Search
          </Label>
          <Input
            id="insight-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title, SKU, vendor…"
          />
        </div>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
        <Button type="button" onClick={() => void runDigest()}>
          Save digest
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">What needs attention</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Priority</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Insight</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insights.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-8 text-center text-sm">
                    {loading ? "Loading…" : "No open insights match your filters."}
                  </TableCell>
                </TableRow>
              ) : (
                insights.map((row) => (
                  <TableRow key={row.insight_key}>
                    <TableCell className="font-mono text-xs">{row.priority.toFixed(2)}</TableCell>
                    <TableCell>{severityBadge(row.severity)}</TableCell>
                    <TableCell className="text-xs">{row.domain}</TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{row.title}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">{row.rationale}</p>
                      <p className="mt-1 text-xs text-primary">{row.recommended_action}</p>
                    </TableCell>
                    <TableCell>{entityLink(row.entity)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() =>
                            setConfirmFeedback({ insight: row, action: "SNOOZED" })
                          }
                        >
                          Snooze
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() =>
                            setConfirmFeedback({ insight: row, action: "DISMISSED" })
                          }
                        >
                          Dismiss
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent digests</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <p className="text-muted-foreground text-sm">No snapshots yet. Run Save digest to capture history.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {snapshots.map((s) => (
                <li key={s.id} className="flex justify-between border-b pb-2 last:border-0">
                  <span>
                    Snapshot #{s.id} · {s.trigger} ·{" "}
                    {new Date(s.generated_at).toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">{s.summary?.total ?? 0} insights</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={confirmFeedback !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) setConfirmFeedback(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {confirmFeedback?.action === "DISMISSED" ? "Dismiss insight" : "Snooze insight"}
            </DialogTitle>
            <DialogDescription>
              {confirmFeedback?.action === "DISMISSED"
                ? "Hide this recommendation from the worklist until data changes materially."
                : "Temporarily hide this recommendation for a number of days."}
            </DialogDescription>
          </DialogHeader>
          {confirmFeedback ? (
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">Title</dt>
                <dd>{confirmFeedback.insight.title}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Rationale</dt>
                <dd>{confirmFeedback.insight.rationale}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Recommended action</dt>
                <dd>{confirmFeedback.insight.recommended_action}</dd>
              </div>
            </dl>
          ) : null}
          {confirmFeedback?.action === "SNOOZED" ? (
            <div className="space-y-2">
              <Label htmlFor="snooze-days">Snooze days</Label>
              <Input
                id="snooze-days"
                type="number"
                min={1}
                max={90}
                value={snoozeDays}
                onChange={(e) => setSnoozeDays(e.target.value)}
              />
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setConfirmFeedback(null)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void submitFeedback()}>
              {submitting ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </InsightsShell>
  );
}
