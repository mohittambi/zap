"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type ActivityLogRow = {
  id: number;
  user_id: number;
  user_email: string | null;
  action: string;
  resource: string | null;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  path: string | null;
  method: string | null;
  status_code: number | null;
  duration_ms: number | null;
  created_at: string;
};

type ActivityLogResponse = {
  total: number;
  page: number;
  limit: number;
  items: ActivityLogRow[];
};

function formatTs(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function detailsPreview(details: Record<string, unknown>) {
  const keys = Object.keys(details ?? {});
  if (keys.length === 0) return "—";
  const text = JSON.stringify(details);
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

function rowsToCsv(items: ActivityLogRow[]) {
  const header = [
    "id",
    "created_at",
    "user_email",
    "action",
    "resource",
    "resource_id",
    "path",
    "method",
    "status_code",
    "ip_address",
    "details",
  ];
  const lines = [header.join(",")];
  for (const row of items) {
    const cells = [
      row.id,
      row.created_at,
      row.user_email ?? "",
      row.action,
      row.resource ?? "",
      row.resource_id ?? "",
      row.path ?? "",
      row.method ?? "",
      row.status_code ?? "",
      row.ip_address ?? "",
      JSON.stringify(row.details ?? {}),
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

export default function ActivityLogPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<ActivityLogResponse | null>(null);
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const [actions, setActions] = React.useState<string[]>([]);
  const [resources, setResources] = React.useState<string[]>([]);

  const [userEmail, setUserEmail] = React.useState("");
  const [action, setAction] = React.useState("");
  const [resource, setResource] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    if (!isAdmin) {
      router.replace("/listings");
    }
  }, [isAdmin, router]);

  const loadMeta = React.useCallback(async () => {
    const [a, r] = await Promise.all([
      apiFetch<{ actions: string[] }>("/api/admin/activity-log?meta=actions"),
      apiFetch<{ resources: string[] }>("/api/admin/activity-log?meta=resources"),
    ]);
    setActions(a.actions ?? []);
    setResources(r.resources ?? []);
  }, []);

  const load = React.useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "100");
      if (userEmail.trim()) params.set("email", userEmail.trim());
      if (action) params.set("action", action);
      if (resource) params.set("resource", resource);
      if (from) params.set("from", new Date(from).toISOString());
      if (to) params.set("to", new Date(to).toISOString());
      const res = await apiFetch<ActivityLogResponse>(
        `/api/admin/activity-log?${params.toString()}`
      );
      setData(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load activity log");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, page, userEmail, action, resource, from, to]);

  React.useEffect(() => {
    if (!isAdmin) return;
    void loadMeta();
  }, [isAdmin, loadMeta]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function exportCsv() {
    if (!data?.items?.length) {
      toast.error("No rows to export");
      return;
    }
    const blob = new Blob([rowsToCsv(data.items)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-log-page-${data.page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!isAdmin) return null;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activity Log</h1>
          <p className="text-sm text-muted-foreground">
            Admin audit trail — logins, navigation, CRUD, and queue actions.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data?.items?.length}>
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="user_email">User email</Label>
            <Input
              id="user_email"
              type="text"
              autoComplete="email"
              value={userEmail}
              onChange={(e) => {
                setUserEmail(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. admin@zap.app"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="action">Action</Label>
            <select
              id="action"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="resource">Resource</Label>
            <select
              id="resource"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={resource}
              onChange={(e) => {
                setResource(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All resources</option>
              {resources.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="from">From</Label>
            <Input
              id="from"
              type="datetime-local"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="datetime-local"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Events {data ? `(${data.total.toLocaleString()} total)` : ""}
          </CardTitle>
          {data && (
            <span className="text-sm text-muted-foreground">
              Page {data.page} / {totalPages}
            </span>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data?.items?.length ? (
            <p className="p-6 text-sm text-muted-foreground">No activity found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Resource ID</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((row) => {
                  const open = expandedId === row.id;
                  return (
                    <React.Fragment key={row.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => setExpandedId(open ? null : row.id)}
                      >
                        <TableCell>
                          {open ? (
                            <ChevronDown className="size-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatTs(row.created_at)}
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate text-xs">
                          {row.user_email ?? `user:${row.user_id}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            {row.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{row.resource ?? "—"}</TableCell>
                        <TableCell className="max-w-[120px] truncate font-mono text-xs">
                          {row.resource_id ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-xs">
                          {row.path ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate font-mono text-[10px]">
                          {detailsPreview(row.details)}
                        </TableCell>
                      </TableRow>
                      {open && (
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableCell colSpan={8}>
                            <div className="grid gap-2 p-2 text-xs sm:grid-cols-2">
                              <div>
                                <span className="text-muted-foreground">IP: </span>
                                {row.ip_address ?? "—"}
                              </div>
                              <div>
                                <span className="text-muted-foreground">Method: </span>
                                {row.method ?? "—"}
                                {row.status_code != null ? ` (${row.status_code})` : ""}
                              </div>
                              <div className="sm:col-span-2">
                                <span className="text-muted-foreground">User agent: </span>
                                <span className="break-all">{row.user_agent ?? "—"}</span>
                              </div>
                              <div className="sm:col-span-2">
                                <span className="text-muted-foreground">Details: </span>
                                <pre className="mt-1 overflow-x-auto rounded bg-background p-2 font-mono text-[10px]">
                                  {JSON.stringify(row.details ?? {}, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && data.total > data.limit && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
