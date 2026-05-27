"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-browser";

type PoLogRow = {
  id: number;
  po_number: string | null;
  consignment_id: number | null;
  foreign_key: number | null;
  operation: string | null;
  remarks: string | null;
  created_by: string | null;
  created_at: string | null;
};

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return d;
  return x.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function ConsignmentLogsTab({
  consignmentId,
  active,
}: Readonly<{ consignmentId: number; active: boolean }>) {
  const [loading, setLoading] = React.useState(false);
  const [rows, setRows] = React.useState<PoLogRow[] | null>(null);

  React.useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await apiFetch<PoLogRow[]>(
          `/api/outbound/consignments/${consignmentId}/logs`
        );
        if (!cancelled) setRows(data);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [consignmentId, active]);

  if (loading && rows === null) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 px-2 py-6 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading logs…
      </p>
    );
  }

  const list = rows ?? [];

  return (
    <div className="w-full overflow-x-auto rounded-md border">
      <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
        <thead>
          <tr className="bg-muted/60 border-b">
            <th className="min-w-[9rem] px-3 py-2 font-semibold">Log ID</th>
            <th className="min-w-[11rem] px-3 py-2 font-semibold">Operation</th>
            <th className="px-3 py-2 font-semibold">PO Number</th>
            <th className="w-28 px-3 py-2 font-semibold">Consignment ID</th>
            <th className="w-24 px-3 py-2 font-semibold">Foreign Key</th>
            <th className="px-3 py-2 font-semibold">Remarks</th>
            <th className="px-3 py-2 font-semibold">Created By</th>
            <th className="px-3 py-2 font-semibold">Created At</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {list.length === 0 ? (
            <tr>
              <td colSpan={8} className="text-muted-foreground px-3 py-8 text-center text-sm">
                No consignment logs found.
              </td>
            </tr>
          ) : (
            list.map((log) => (
              <tr key={log.id}>
                <td
                  className="max-w-[10rem] truncate px-3 py-2 font-mono text-xs tabular-nums"
                  title={String(log.id)}
                >
                  {log.id}
                </td>
                <td className="min-w-[11rem] px-3 py-2 text-xs break-words">
                  {log.operation ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{log.po_number ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{log.consignment_id ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{log.foreign_key ?? "—"}</td>
                <td className="px-3 py-2 text-xs whitespace-pre-wrap break-words">
                  {log.remarks ?? "—"}
                </td>
                <td className="px-3 py-2 text-xs break-words">{log.created_by ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs">
                  {fmtDateTime(log.created_at)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
