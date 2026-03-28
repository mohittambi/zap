"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

type SubRow = { sub_category: string; form_name: string };

export default function FormsCategoryPage() {
  const params = useParams();
  const category = decodeURIComponent(String(params.category ?? ""));
  const [rows, setRows] = React.useState<SubRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let c = false;
    (async () => {
      try {
        const data = await apiFetch<SubRow[]>(
          `/api/forms/categories/${encodeURIComponent(category)}`
        );
        if (!c) setRows(data);
      } catch (e) {
        if (!c) toast.error(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [category]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/forms">← Categories</Link>
      </Button>
      <h1 className="text-2xl font-semibold">{category}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sub-categories</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <EmptyState title="No sub-categories" />
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((r) => (
                <li key={r.sub_category}>
                  <Link
                    href={`/forms/${encodeURIComponent(category)}/${encodeURIComponent(r.sub_category)}`}
                    className="flex min-h-11 flex-col rounded-lg border bg-card px-4 py-3 text-sm transition-colors hover:bg-muted/50"
                  >
                    <span className="font-medium">{r.sub_category}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.form_name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
