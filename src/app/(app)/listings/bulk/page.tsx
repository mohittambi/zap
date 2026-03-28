"use client";

import { toast } from "sonner";
import { apiUrl, getStoredToken } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function download(path: string, filename: string) {
  try {
    const headers = new Headers();
    const token = getStoredToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(apiUrl(path), { headers });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Download started");
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Failed");
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
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

export default function BulkOperationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-primary text-2xl font-semibold">Bulk Operations</h1>
        <p className="text-sm text-muted-foreground">
          Export CSV snapshots or import spreadsheets (admin / warehouse manager).
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-primary/10 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Export Operations</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="min-h-11 justify-start"
              onClick={() =>
                void download("/api/bulk/export/secondary-listings", "secondary_listings.csv")
              }
            >
              Download Secondary Listings File
            </Button>
            <Button
              variant="outline"
              className="min-h-11 justify-start"
              onClick={() =>
                void download("/api/bulk/export/packs-combos", "packs_combos.csv")
              }
            >
              Download Packs &amp; Combos File
            </Button>
            <Button
              variant="outline"
              className="min-h-11 justify-start"
              onClick={() =>
                void download("/api/bulk/export/ais-listings", "ais_listings.csv")
              }
            >
              Download AIS Listings File
            </Button>
            <Button
              variant="outline"
              className="min-h-11 justify-start"
              onClick={() =>
                void download("/api/bulk/export/master-sku-details", "master_sku_details.csv")
              }
            >
              Download Master SKU Details File
            </Button>
          </CardContent>
        </Card>
        <Card className="border-primary/10 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Import Operations</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="space-y-2">
              <Label htmlFor="imp-sec">Add/Update Secondary Listings</Label>
              <Input
                id="imp-sec"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="min-h-11"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const r = await upload("/api/bulk/import/secondary-listings", f);
                    toast.success(`Imported ${r.imported} rows`);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed");
                  }
                  e.target.value = "";
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imp-pc">Add/Update Packs &amp; Combos</Label>
              <Input
                id="imp-pc"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="min-h-11"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const r = await upload("/api/bulk/import/packs-combos", f);
                    toast.success(`Imported ${r.imported} rows`);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed");
                  }
                  e.target.value = "";
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imp-ais">Add/Update AIS Listings</Label>
              <Input
                id="imp-ais"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="min-h-11"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const r = await upload("/api/bulk/import/ais-listings", f);
                    toast.success(`Imported ${r.imported} rows`);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed");
                  }
                  e.target.value = "";
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
