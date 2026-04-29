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
type Wh = { id: number; name: string };

export default function WarehousesPage() {
  const [rows, setRows] = React.useState<Wh[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let c = false;
    (async () => {
      try {
        const data = await apiFetch<Wh[]>("/api/warehouses");
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
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Warehouses</h1>
        <p className="text-sm text-muted-foreground">Master warehouse directory.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 hover:bg-muted/60">
                <TableHead className="w-24">ID</TableHead>
                <TableHead>Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {[1, 2].map((j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : rows.length === 0
                ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-muted-foreground py-10 text-center text-sm">
                      No warehouses found.
                    </TableCell>
                  </TableRow>
                )
                : rows.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-mono text-sm">{w.id}</TableCell>
                      <TableCell>
                        <Link
                          className="text-primary underline-offset-4 hover:underline"
                          href={`/warehouses/${w.id}`}
                        >
                          {w.name}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
