"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

type Vendor = {
  id: number;
  vendor_name: string;
  vendor_city?: string;
};

export default function VendorsPage() {
  const [rows, setRows] = React.useState<Vendor[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let c = false;
    (async () => {
      try {
        const data = await apiFetch<Vendor[]>("/api/vendors/all");
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
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Vendors</h1>
        <p className="text-sm text-muted-foreground">
          Directory of vendors and specialties.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All vendors</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : rows.length === 0 ? (
            <EmptyState title="No vendors" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>City</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-sm">{v.id}</TableCell>
                      <TableCell>
                        <Link
                          href={`/vendors/${v.id}`}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {v.vendor_name ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell>{v.vendor_city ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
