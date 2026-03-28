"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function FormDefinitionPage() {
  const params = useParams();
  const category = decodeURIComponent(String(params.category ?? ""));
  const subCategory = decodeURIComponent(String(params.subCategory ?? ""));
  const [data, setData] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await apiFetch<Record<string, unknown>>(
          `/api/forms/categories/${encodeURIComponent(category)}/${encodeURIComponent(subCategory)}`
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
  }, [category, subCategory]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/forms/${encodeURIComponent(category)}`}>← Sub-categories</Link>
      </Button>
      <div>
        <h1 className="text-xl font-semibold">{subCategory}</h1>
        <p className="text-sm text-muted-foreground">{category}</p>
      </div>
      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : data ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Form payload</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[70dvh] overflow-auto font-mono text-xs whitespace-pre-wrap break-all">
              {JSON.stringify(data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
