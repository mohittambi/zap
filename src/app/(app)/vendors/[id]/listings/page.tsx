"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function VendorListingsPage() {
  const params = useParams();
  const vendorId = String(params.id ?? "");
  const [data, setData] = React.useState<unknown[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await apiFetch<unknown[]>(
          `/api/vendors/listings/${encodeURIComponent(vendorId)}`
        );
        if (!c) setData(res);
      } catch (e) {
        if (!c) toast.error(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [vendorId]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/vendors/${vendorId}`}>← Vendor</Link>
      </Button>
      <h1 className="text-2xl font-semibold">Vendor listings</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SKUs</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <pre className="max-h-[70dvh] overflow-auto font-mono text-xs whitespace-pre-wrap break-all">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
