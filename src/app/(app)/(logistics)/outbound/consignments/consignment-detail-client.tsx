"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { OutboundConsignmentRow } from "@/server/services/outboundConsignmentsService";

export function ConsignmentDetailClient({ id }: { id: string }) {
  const [loading, setLoading] = React.useState(true);
  const [row, setRow] = React.useState<OutboundConsignmentRow | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await apiFetch<OutboundConsignmentRow>(
          `/api/outbound/consignments/${encodeURIComponent(id)}`
        );
        if (!cancelled) setRow(data);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Failed to load");
          setRow(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 px-2 py-8 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading consignment…
      </div>
    );
  }

  if (err || !row) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-2 py-6">
        <p className="text-destructive text-sm">{err ?? "Not found"}</p>
        <Button variant="outline" asChild>
          <Link href="/outbound/consignments">Back to consignments</Link>
        </Button>
      </div>
    );
  }

  const entries = Object.entries(row).filter(([k]) => k !== "raw");
  const rawKeys = Object.keys(row.raw ?? {});

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-2 py-4 md:px-4">
      <Button variant="ghost" size="sm" asChild className="gap-1">
        <Link href="/outbound/consignments">
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Consignment {row.id}</CardTitle>
          <CardDescription>
            Denormalized columns plus full upstream JSON in <code className="text-xs">raw</code>{" "}
            (full upstream payload).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {entries.map(([k, v]) => (
              <div key={k} className="border-b border-dashed pb-2">
                <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  {k.replaceAll("_", " ")}
                </dt>
                <dd className="mt-0.5 font-mono text-xs break-all">
                  {v === null || v === undefined
                    ? "—"
                    : typeof v === "object"
                      ? JSON.stringify(v)
                      : String(v)}
                </dd>
              </div>
            ))}
          </dl>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">
              Raw API keys ({rawKeys.length})
            </h3>
            <pre className="bg-muted max-h-[420px] overflow-auto rounded-md p-3 text-xs">
              {JSON.stringify(row.raw, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
