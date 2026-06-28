"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiUrl, getStoredToken } from "@/lib/api-browser";
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const bulkBtn =
  "flex min-h-[52px] w-full items-center justify-center rounded-none border-2 border-foreground bg-background px-4 text-center text-sm font-medium text-foreground shadow-none transition-colors hover:bg-muted/70 active:bg-muted";

async function download(path: string, filename: string) {
  try {
    const headers = new Headers();
    const token = getStoredToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(apiUrl(path), { headers });
    if (!res.ok) {
      const t = await res.text();
      let msg = t || res.statusText;
      try {
        const j = JSON.parse(t) as { error?: string };
        if (j.error) msg = j.error;
      } catch {
        /* plain text */
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`Downloaded ${filename}`);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Download failed");
  }
}

async function upload(path: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const token = getStoredToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers,
    body: fd,
  });
  const json = (await res.json().catch(() => ({}))) as {
    imported?: number;
    errors?: { row: number; message: string }[];
    error?: string;
  };
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

function ImportBlock({
  title,
  inputId,
  uploadPath,
  sampleHref,
  sampleFilename,
}: {
  title: string;
  inputId: string;
  uploadPath: string;
  sampleHref: string;
  sampleFilename: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        disabled={busy}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            const r = await upload(uploadPath, f);
            const n = r.imported ?? 0;
            const errs = r.errors ?? [];
            if (errs.length > 0) {
              const preview = errs
                .slice(0, 4)
                .map((x) => `Row ${x.row}: ${x.message}`)
                .join("\n");
              toast.warning(`Imported ${n} rows; ${errs.length} row error(s)`, {
                description: preview + (errs.length > 4 ? "\n…" : ""),
              });
            } else {
              toast.success(`Imported ${n} rows`);
            }
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Import failed");
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
      <button
        type="button"
        disabled={busy}
        className={cn(bulkBtn, busy && "pointer-events-none opacity-60")}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Working…" : title}
      </button>
      <p className="text-muted-foreground text-xs leading-relaxed">
        CSV or Excel (first sheet).{" "}
        <Link
          href={sampleHref}
          download={sampleFilename}
          className="text-primary font-medium underline-offset-2 hover:underline"
        >
          Download sample CSV ({sampleFilename})
        </Link>
      </p>
    </div>
  );
}

export default function BulkOperationsPage() {
  return (
    <div className="space-y-6">
      <AppPageTitle
        title="Bulk Operations"
        description="Export full CSV snapshots from the database, or import spreadsheets to create master SKUs, add or update secondary listings, pack/combo BOM rows, and AIS (platform) quantities. Requires bulk read / import permissions; master listing import also requires listings write."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-border rounded-lg border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Export Operations</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-muted-foreground mb-1 text-xs">
              Files include current DB columns. Secondary and AIS exports include JSON columns (
              <span className="font-mono">company_details</span>,{" "}
              <span className="font-mono">labels_data</span>
              ); secondary also includes <span className="font-mono">sku_wise_details_raw</span>.
              Master SKU export includes images, dimensions, and a <span className="font-mono">bins</span> column (bin-level stock detail).
            </p>
            <button
              type="button"
              className={bulkBtn}
              onClick={() =>
                void download("/api/bulk/export/secondary-listings", "secondary_listings.csv")
              }
            >
              Download Secondary Listings File
            </button>
            <button
              type="button"
              className={bulkBtn}
              onClick={() =>
                void download("/api/bulk/export/packs-combos", "packs_combos.csv")
              }
            >
              Download Packs &amp; Combos File
            </button>
            <button
              type="button"
              className={bulkBtn}
              onClick={() =>
                void download("/api/bulk/export/ais-listings", "ais_listings.csv")
              }
            >
              Download AIS Listings File
            </button>
            <button
              type="button"
              className={bulkBtn}
              onClick={() =>
                void download("/api/bulk/export/master-sku-details", "master_sku_details.csv")
              }
            >
              Download Master SKU Details File
            </button>
          </CardContent>
        </Card>

        <Card className="border-border rounded-lg border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Import Operations</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <p className="text-muted-foreground text-xs leading-relaxed">
              Imports use the <span className="font-mono">xlsx</span> parser (CSV and Excel).{" "}
              <strong>Master listings</strong> (create-only): required columns{" "}
              <span className="font-mono">sku_id</span>,{" "}
              <span className="font-mono">description</span>; optional classification,
              pricing, and image URL columns — see sample CSV. Duplicate{" "}
              <span className="font-mono">sku_id</span> values are reported as row errors
              (existing eAutomate or Zap rows are not overwritten). Requires{" "}
              <span className="font-mono">listings:write</span> in addition to{" "}
              <span className="font-mono">bulk:import</span>. Secondary / AIS: snake_case
              headers (
              <span className="font-mono">secondary_sku</span>,{" "}
              <span className="font-mono">master_sku</span>, …) or legacy headers from sample
              data (Channel SKU, Master SKU, Inventory SKU, Pack Combo SKU, SKU Type, Bypass
              Status, Platform Stock, Warehouse Stock). Pack/combo:{" "}
              <span className="font-mono">parent_sku_id</span>,{" "}
              <span className="font-mono">component_sku_id</span>,{" "}
              <span className="font-mono">quantity</span> — or &quot;Bundle SKU (Parent)&quot;,
              &quot;Component SKU&quot;, &quot;Component Quantity&quot;. Parent and component SKUs
              must already exist in <span className="font-mono">listings</span> (FK).
            </p>

            <ImportBlock
              title="Create Master Listings (CSV)"
              inputId="bulk-import-master-listings"
              uploadPath="/api/bulk/import/master-listings"
              sampleHref="/samples/bulk/sample_master_listings_import.csv"
              sampleFilename="sample_master_listings_import.csv"
            />
            <ImportBlock
              title="Add/Update Secondary Listings"
              inputId="bulk-import-secondary"
              uploadPath="/api/bulk/import/secondary-listings"
              sampleHref="/samples/bulk/sample_secondary_listings_import.csv"
              sampleFilename="sample_secondary_listings_import.csv"
            />
            <ImportBlock
              title="Add/Update Packs & Combos"
              inputId="bulk-import-packs"
              uploadPath="/api/bulk/import/packs-combos"
              sampleHref="/samples/bulk/sample_packs_combos_import.csv"
              sampleFilename="sample_packs_combos_import.csv"
            />
            <ImportBlock
              title="Add/Update AIS Listings"
              inputId="bulk-import-ais"
              uploadPath="/api/bulk/import/ais-listings"
              sampleHref="/samples/bulk/sample_ais_listings_import.csv"
              sampleFilename="sample_ais_listings_import.csv"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
