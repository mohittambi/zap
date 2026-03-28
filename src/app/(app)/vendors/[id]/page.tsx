"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function VendorDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [data, setData] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await apiFetch<Record<string, unknown>>(
          `/api/vendors/${encodeURIComponent(id)}`
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
    return <Skeleton className="h-96 w-full max-w-4xl" />;
  }

  if (!data) {
    return (
      <div>
        <p className="text-muted-foreground">Vendor not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/vendors">Back</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/vendors">← Vendors</Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold">
          {String(data.vendor_name ?? "Vendor")}
        </h1>
        <p className="font-mono text-sm text-muted-foreground">id {id}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[70dvh] overflow-auto font-mono text-xs whitespace-pre-wrap break-all">
            {JSON.stringify(data, null, 2)}
          </pre>
        </CardContent>
      </Card>
      <Button asChild>
        <Link href={`/vendors/${id}/listings`}>View vendor listings</Link>
      </Button>
    </div>
  );
}
