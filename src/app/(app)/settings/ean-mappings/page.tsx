"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, apiUrl, getStoredToken } from "@/lib/api-browser";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CompanyNameWithLogo } from "@/components/company/company-logo";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EanMappingsImportPreviewDialog,
  previewEanMappingsImportFile,
} from "@/components/settings/ean-mappings-import-preview-dialog";
import type { EanImportPreview } from "@/server/services/eanMappingsImportService";

type MappingRow = {
  id: number;
  sku_code: string;
  company_id: number;
  company_name: string | null;
  zap_ean: string | null;
  ean_type: string | null;
  universal_ean: string | null;
};

type PageData = {
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: MappingRow[];
  summary?: { total_mappings: number; sku_count: number };
};

type CompanyOpt = { id: number; name: string | null };

export default function EanMappingsPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const isAdmin = hasPermission("*", "*");

  const [draftSearch, setDraftSearch] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [companyId, setCompanyId] = React.useState<string>("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<PageData | null>(null);
  const [companies, setCompanies] = React.useState<CompanyOpt[]>([]);
  const [loading, setLoading] = React.useState(true);
  const importRef = React.useRef<HTMLInputElement>(null);
  const [importPreviewOpen, setImportPreviewOpen] = React.useState(false);
  const [importPreview, setImportPreview] = React.useState<EanImportPreview | null>(
    null
  );
  const [importPendingFile, setImportPendingFile] = React.useState<File | null>(null);
  const [importPreviewBusy, setImportPreviewBusy] = React.useState(false);

  React.useEffect(() => {
    if (user && !isAdmin) {
      router.replace("/");
    }
  }, [user, isAdmin, router]);

  React.useEffect(() => {
    if (!isAdmin) return;
    void apiFetch<{ content: CompanyOpt[] }>("/api/ean-mappings/companies")
      .then((r) => setCompanies(r.content ?? []))
      .catch(() => setCompanies([]));
  }, [isAdmin]);

  const load = React.useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        limit: "50",
      });
      if (search.trim()) q.set("search", search.trim());
      if (companyId) q.set("company_id", companyId);
      const res = await apiFetch<PageData>(`/api/ean-mappings?${q}`);
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load mappings");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, page, search, companyId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (!user) {
    return (
      <div className="text-muted-foreground px-2 py-8 text-sm">Loading…</div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-2 py-8">
        <p className="text-destructive text-sm">Admin access required.</p>
        <Button variant="outline" asChild>
          <Link href="/">Home</Link>
        </Button>
      </div>
    );
  }

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.per_page_count))
    : 1;

  return (
    <div className="space-y-6 px-2 py-4 md:px-4">
      <div>
        <h1 className="text-primary text-2xl font-semibold">EAN Code Mappings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Company-specific EAN and item codes per SKU. Used on outbound PO line items and
          consignment dispatch views. Seed from{" "}
          <span className="font-mono text-xs">npm run seed:ean-mappings</span>.
        </p>
        {data?.summary ? (
          <p className="text-muted-foreground mt-2 text-xs">
            {data.summary.total_mappings.toLocaleString()} mapping rows ·{" "}
            {data.summary.sku_count.toLocaleString()} distinct SKUs
            {companyId
              ? ` · filtered by ${companies.find((c) => String(c.id) === companyId)?.name ?? "company"}`
              : ""}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const q = new URLSearchParams();
              if (companyId) q.set("company_id", companyId);
              if (search.trim()) q.set("search", search.trim());
              const token = getStoredToken();
              const url = apiUrl(
                `/api/ean-mappings/export${q.toString() ? `?${q}` : ""}`
              );
              void fetch(url, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              })
                .then(async (res) => {
                  if (!res.ok) throw new Error(await res.text());
                  const blob = await res.blob();
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = "ean_mappings.csv";
                  a.click();
                  URL.revokeObjectURL(a.href);
                })
                .catch((e) =>
                  toast.error(e instanceof Error ? e.message : "Export failed")
                );
            }}
          >
            Export CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={importPreviewBusy}
            onClick={() => importRef.current?.click()}
          >
            {importPreviewBusy ? "Loading…" : "Import CSV"}
          </Button>
          <Button type="button" variant="ghost" size="sm" asChild>
            <a
              href="/samples/ean-mappings/sample_ean_mappings_import.csv"
              download
            >
              Download sample
            </a>
          </Button>
          <input
            ref={importRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setImportPreviewBusy(true);
              try {
                const preview = await previewEanMappingsImportFile(f);
                if (
                  preview.stats.errorCount > 0 &&
                  preview.stats.newCount === 0 &&
                  preview.stats.replaceCount === 0
                ) {
                  toast.error(
                    `Import has ${preview.stats.errorCount} error row(s). Fix the CSV and try again.`
                  );
                  return;
                }
                setImportPendingFile(f);
                setImportPreview(preview);
                setImportPreviewOpen(true);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Import preview failed");
              } finally {
                setImportPreviewBusy(false);
              }
            }}
          />
        </div>
      </div>

      <EanMappingsImportPreviewDialog
        open={importPreviewOpen}
        onOpenChange={setImportPreviewOpen}
        preview={importPreview}
        pendingFile={importPendingFile}
        onApplied={() => {
          setImportPendingFile(null);
          setImportPreview(null);
          void load();
        }}
      />

      <Card className="border-primary/10 shadow-sm">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="min-w-[200px] flex-1 space-y-2">
            <Label htmlFor="ean-company">Company</Label>
            <select
              id="ean-company"
              className="border-input bg-background h-11 w-full rounded-md border px-3 text-sm"
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name ?? `Company ${c.id}`}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[220px] flex-[2] space-y-2">
            <Label htmlFor="ean-search">Search</Label>
            <Input
              id="ean-search"
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  setSearch(draftSearch);
                }
              }}
              placeholder="SKU code or EAN value…"
              className="min-h-11"
            />
          </div>
          <div className="flex gap-2">
            <Button
              className="min-h-11"
              onClick={() => {
                setPage(1);
                setSearch(draftSearch);
              }}
            >
              Apply
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                setDraftSearch("");
                setSearch("");
                setCompanyId("");
                setPage(1);
              }}
            >
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead>SKU Code</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Zap EAN / Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Universal EAN 1</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : !data?.content?.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-muted-foreground py-10 text-center text-sm"
                    >
                      No mappings found. Run{" "}
                      <span className="font-mono">npm run migrate</span> then{" "}
                      <span className="font-mono">npm run seed:ean-mappings</span>.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.content.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.sku_code}</TableCell>
                      <TableCell>
                        <CompanyNameWithLogo
                          name={row.company_name}
                          companyId={row.company_id}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">
                        {row.zap_ean?.trim() ? row.zap_ean : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{row.ean_type ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">
                        {row.universal_ean?.trim() ? row.universal_ean : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {data && data.total > data.per_page_count ? (
            <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
              <p className="text-muted-foreground text-xs">
                Page {data.current_page} of {totalPages} ({data.total} rows)
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
