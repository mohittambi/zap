"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { AppPageShell, AppPageTitle } from "@/components/layout/app-page-shell";
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
    <AppPageShell>
      <AppPageTitle title="Vendors" description="Directory of vendors and specialties." />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All vendors</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 hover:bg-muted/60">
                <TableHead className="w-24">ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>City</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {[1, 2, 3].map((j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : rows.length === 0
                ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground py-10 text-center text-sm">
                      No vendors found.
                    </TableCell>
                  </TableRow>
                )
                : rows.map((v) => (
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
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
