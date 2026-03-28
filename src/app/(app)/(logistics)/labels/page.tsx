"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiUrl, getStoredToken } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { cn } from "@/lib/utils";

const SAMPLE_HREF = "/samples/eCraftZap-label-date-template.csv";

export default function LabelsTopLevelPage() {
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function onUpload() {
    if (!file) {
      toast.error("Choose a CSV file first");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = getStoredToken();
      const res = await fetch(apiUrl("/api/labels/upload"), {
        method: "POST",
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const ct = res.headers.get("content-type") ?? "";

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? res.statusText);
      }

      if (ct.includes("application/pdf")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "rotated_labels.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success("Downloaded rotated_labels.pdf", {
          description:
            "Fixed layout: bottom EAN-13/Code128 (PNG), 8pt text, ~10mm margins — no QR.",
        });
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }

      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        dataRowCount?: number;
      };
      toast.success(json.message ?? "OK", {
        description:
          json.dataRowCount != null
            ? `${json.dataRowCount} data row(s) in file`
            : undefined,
      });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-0">
      <AppPageTitle
        title="Labels"
        description="Upload a filled CSV to generate rotated label PDFs (40×70mm, 90°) matching the standard eCraft layout."
        className="mb-4"
      />

      {/* Inner purple toolbar (matches eCraft Zap Labels — Generate Labels tab) */}
      <div className="bg-primary text-primary-foreground -mx-4 mb-6 px-2 md:-mx-8 md:px-4">
        <div
          className="inline-flex min-h-11 items-center border-b-2 border-white bg-white px-4 py-3 text-sm font-medium text-primary"
          aria-current="page"
        >
          Generate Labels
        </div>
      </div>

      <Card className="mx-auto max-w-3xl border-primary/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Upload label requirement, in the provided format
          </CardTitle>
          <CardDescription className="text-foreground/80">
            Download the sample file, fill in your rows, then upload — you will get{" "}
            <strong>rotated_labels.pdf</strong> with one page per label (duplicated{" "}
            <code className="text-xs">labelCount</code> times per row).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm">
            <Link
              href={SAMPLE_HREF}
              download="eCraftZap-label-date-template.csv"
              className="text-primary font-medium underline underline-offset-2 hover:text-primary/80"
            >
              [Download Sample File]
            </Link>
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="label-csv" className="sr-only">
                CSV file
              </Label>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  id="label-csv"
                  className="min-h-11"
                  onClick={() => inputRef.current?.click()}
                >
                  Choose file
                </Button>
                <span className="text-muted-foreground text-sm">
                  {file ? file.name : "No file chosen"}
                </span>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setFile(f ?? null);
                  }}
                />
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            className={cn(
              "min-h-11 min-w-[120px]",
              !file && "pointer-events-none opacity-50"
            )}
            disabled={!file || uploading}
            onClick={() => void onUpload()}
          >
            {uploading ? "Generating…" : "Generate PDF"}
          </Button>

          <p className="text-muted-foreground text-xs leading-relaxed">
            Columns: barcode, marketedBy, manufacturedBy, title,
            dateOfManufacture, color, brand, material, netQuantity,
            productDimension, oneSetContains, modelNumber, mrp,
            countryOfOrigin, styleId, qrSequence (optional; not shown — no QR in PDF), labelCount. For master SKU / MRP
            lookups, use{" "}
            <Link
              href="/listings/labels-master"
              className="text-primary underline underline-offset-2"
            >
              Labels Master Data
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
