"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export default function FormsIndexPage() {
  const [categories, setCategories] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let c = false;
    (async () => {
      try {
        const data = await apiFetch<string[]>("/api/forms/categories");
        if (!c) setCategories(data);
      } catch (e) {
        if (!c) toast.error(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Forms</h1>
        <p className="text-sm text-muted-foreground">
          Pick a category to see sub-categories and form definitions.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Categories</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : categories.length === 0 ? (
            <EmptyState title="No form categories" />
          ) : (
            <ul className="flex flex-col gap-2">
              {categories.map((cat) => (
                <li key={cat}>
                  <Link
                    href={`/forms/${encodeURIComponent(cat)}`}
                    className="flex min-h-11 items-center rounded-lg border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/50"
                  >
                    {cat}
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
