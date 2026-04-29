"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

export default function VendorListingsPage() {
  const params = useParams();
  const vendorId = str(params.id ?? "");
  const [data, setData] = React.useState<unknown[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await apiFetch<unknown[]>(
          `/api/vendors/listings/${encodeURIComponent(vendorId)}`
        );
        if (!c) setData(Array.isArray(res) ? res : []);
      } catch (e) {
        if (!c) toast.error(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => { c = true; };
  }, [vendorId]);

  /* Derive column keys from first row */
  const cols = React.useMemo(() => {
    if (!data.length) return [];
    const first = data[0];
    if (!first || typeof first !== "object" || Array.isArray(first)) return [];
    return Object.keys(first as Record<string, unknown>).slice(0, 10);
  }, [data]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`/vendors/${vendorId}`}>← Vendor {vendorId}</Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold">Vendor SKUs</h1>
        <p className="text-muted-foreground text-sm">Listings associated with vendor {vendorId}.</p>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 hover:bg-muted/60">
                {loading
                  ? ["SKU", "Type", "Quantity", "Status", "Details"].map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))
                  : cols.map((c) => (
                      <TableHead key={c} className="whitespace-nowrap text-xs">
                        {c.replaceAll("_", " ")}
                      </TableHead>
                    ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {[1, 2, 3, 4, 5].map((j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : !data.length
                ? (
                  <TableRow>
                    <TableCell colSpan={Math.max(cols.length, 5)} className="text-muted-foreground py-10 text-center text-sm">
                      No listings found for this vendor.
                    </TableCell>
                  </TableRow>
                )
                : data.map((row, idx) => {
                    const r = row as Record<string, unknown>;
                    return (
                      <TableRow key={idx} className={idx % 2 === 1 ? "bg-muted/20" : ""}>
                        {cols.map((c) => {
                          const v = r[c];
                          const isId = c.includes("sku") || c.includes("id");
                          return (
                            <TableCell
                              key={c}
                              className={`text-xs ${isId ? "font-mono" : ""}`}
                            >
                              {v == null ? "—" : String(v)}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {!loading && data.length > 0 ? (
        <p className="text-muted-foreground text-xs">{data.length} SKU(s) found.</p>
      ) : null}
    </div>
  );
}
