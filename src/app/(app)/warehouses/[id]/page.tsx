"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function WarehouseDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [data, setData] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await apiFetch<Record<string, unknown>>(
          `/api/warehouses/${encodeURIComponent(id)}`
        );
        if (!c) setData(res);
      } catch (e) {
        if (!c) toast.error(e instanceof Error ? e.message : "Not found");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [id]);

  if (loading) {
    return <Skeleton className="h-64 max-w-2xl" />;
  }

  if (!data) {
    return (
      <div>
        <Button asChild variant="outline">
          <Link href="/warehouses">Back</Link>
        </Button>
        <p className="mt-4 text-muted-foreground">Not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/warehouses">← Warehouses</Link>
      </Button>
      <h1 className="text-2xl font-semibold">{String(data.name ?? "Warehouse")}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="font-mono text-xs whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
