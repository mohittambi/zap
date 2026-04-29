"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { formatCatalogueDate } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  EditCatalogueDialog,
  type CatRow,
} from "./edit-catalogue-dialog";

type PageData = {
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: CatRow[];
};

export default function CataloguesPage() {
  const router = useRouter();
  const [tab, setTab] = React.useState<"standard" | "custom">("standard");
  const [draft, setDraft] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<PageData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createName, setCreateName] = React.useState("");
  const [createDesc, setCreateDesc] = React.useState("");
  const [createSubmitting, setCreateSubmitting] = React.useState(false);

  const [editTarget, setEditTarget] = React.useState<CatRow | null>(null);

  const [deleteTarget, setDeleteTarget] = React.useState<CatRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        count: "28",
        catalogue_type: tab,
      });
      if (keyword.trim()) q.set("search_keyword", keyword.trim());
      const res = await apiFetch<PageData>(`/api/catalogues?${q}`);
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [keyword, page, tab]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/catalogues/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Catalogue deleted");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function createCatalogue() {
    if (!createName.trim()) {
      toast.error("Name required");
      return;
    }
    setCreateSubmitting(true);
    try {
      const c = await apiFetch<{ id: number }>("/api/catalogues", {
        method: "POST",
        body: JSON.stringify({
          catalogue_type: tab,
          name: createName.trim(),
          description: createDesc.trim() || undefined,
        }),
      });
      toast.success("Catalogue created");
      setCreateName("");
      setCreateDesc("");
      setCreateOpen(false);
      void load();
      router.push(`/catalogues/${c.id}/builder`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreateSubmitting(false);
    }
  }

  const total = data?.total ?? 0;
  const perPage = data?.per_page_count ?? 28;
  const currCount = data?.curr_page_count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / perPage) || 1);

  let summaryLine = "";
  if (data) {
    summaryLine = `Showing ${currCount} of ${total} catalogue(s) · Page ${page} of ${lastPage}`;
  } else if (loading) {
    summaryLine = "Loading…";
  }

  const hasRows = Boolean(data?.content?.length);

  return (
    <div className="space-y-6">
      <AppPageTitle
        title="Catalogues"
        description="Standard and custom product brochures with SKU counts and builder access."
      />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as "standard" | "custom");
          setPage(1);
        }}
        className="w-full"
      >
        <Card className="border-primary/10 shadow-sm">
          <CardHeader className="space-y-4 border-b pb-4">
            <TabsList
              variant="line"
              className="h-auto w-full min-w-0 flex-wrap justify-start gap-0 rounded-none border-0 bg-transparent p-0"
            >
              <TabsTrigger
                value="standard"
                className="shrink-0 rounded-none border-b-2 border-transparent px-3 py-2.5 text-sm font-medium data-active:border-primary data-active:bg-transparent data-active:shadow-none sm:px-4"
              >
                Standard Catalogues
              </TabsTrigger>
              <TabsTrigger
                value="custom"
                className="shrink-0 rounded-none border-b-2 border-transparent px-3 py-2.5 text-sm font-medium data-active:border-primary data-active:bg-transparent data-active:shadow-none sm:px-4"
              >
                Custom Catalogues
              </TabsTrigger>
            </TabsList>

            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger
                  render={
                    <Button type="button" className="min-h-11 w-full shrink-0 sm:w-auto">
                      Create New Catalogue
                    </Button>
                  }
                />
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Catalogue</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="cat-name">Name</Label>
                      <Input
                        id="cat-name"
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                        placeholder="Catalogue name"
                        className="min-h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cat-desc">Description (optional)</Label>
                      <Input
                        id="cat-desc"
                        value={createDesc}
                        onChange={(e) => setCreateDesc(e.target.value)}
                        placeholder="Description"
                        className="min-h-11"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCreateOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={createSubmitting}
                      onClick={() => void createCatalogue()}
                    >
                      {createSubmitting ? "Creating…" : "Create"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
                <div className="relative min-w-0 flex-1 sm:max-w-md">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setPage(1);
                        setKeyword(draft);
                      }
                    }}
                    placeholder="Search by name or ID…"
                    className="min-h-11 pr-3 pl-10"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 w-full shrink-0 sm:w-auto"
                  onClick={() => {
                    setPage(1);
                    setKeyword(draft);
                  }}
                >
                  <Search className="mr-2 size-4" />
                  Search
                </Button>
              </div>
            </div>
          </CardHeader>

          <TabsContent value={tab} className="m-0 outline-none">
            <CardContent className="space-y-4 p-0 pt-0">
              <p className="text-muted-foreground px-4 pt-4 text-sm">
                {summaryLine}
              </p>

              {loading && (
                <div className="px-4 pb-4">
                  <Skeleton className="h-64 w-full rounded-lg" />
                </div>
              )}
              {!loading && data && !hasRows && (
                <div className="px-4 pb-8">
                  <EmptyState title="No catalogues" />
                </div>
              )}
              {!loading && hasRows && data && (
                <>
                  <div className="hidden overflow-x-auto lg:block">
                    <Table className="min-w-[880px]">
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="w-[100px] text-left font-semibold">
                            Catalogue Id
                          </TableHead>
                          <TableHead className="min-w-[140px] text-left font-semibold">
                            Catalogue Name
                          </TableHead>
                          <TableHead className="min-w-[200px] font-semibold">
                            Catalogue Description
                          </TableHead>
                          <TableHead className="w-[100px] text-right font-semibold">
                            SKU Count
                          </TableHead>
                          <TableHead className="min-w-[120px] whitespace-nowrap font-semibold">
                            Last Updated
                          </TableHead>
                          <TableHead className="min-w-[120px] font-semibold">
                            Created By
                          </TableHead>
                          <TableHead className="w-[130px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.content.map((row, i) => (
                          <TableRow
                            key={row.id}
                            className={cn(i % 2 === 1 && "bg-muted/20")}
                          >
                            <TableCell className="text-left tabular-nums">
                              <Link
                                href={`/catalogues/${row.id}/builder`}
                                className="text-primary font-medium underline underline-offset-2 hover:text-primary/80"
                              >
                                {row.id}
                              </Link>
                            </TableCell>
                            <TableCell className="font-medium">
                              {row.name}
                            </TableCell>
                            <TableCell className="max-w-[280px] truncate text-muted-foreground text-sm">
                              {row.description ?? "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.sku_count}
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {row.updated_at
                                ? formatCatalogueDate(row.updated_at)
                                : "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {row.created_by ?? "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => setEditTarget(row)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive h-7 px-2 text-xs"
                                  onClick={() => setDeleteTarget(row)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-col gap-3 px-4 lg:hidden">
                    {data.content.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-lg border bg-card p-4 text-sm shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/catalogues/${row.id}/builder`}
                            className="text-primary font-semibold underline underline-offset-2"
                          >
                            #{row.id}
                          </Link>
                          <span className="text-muted-foreground tabular-nums text-xs">
                            {row.sku_count} SKUs
                          </span>
                        </div>
                        <p className="mt-2 font-medium leading-snug">
                          {row.name}
                        </p>
                        {row.description ? (
                          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                            {row.description}
                          </p>
                        ) : null}
                        <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                          <span>
                            Updated:{" "}
                            {row.updated_at
                              ? formatCatalogueDate(row.updated_at)
                              : "—"}
                          </span>
                          <span>By: {row.created_by ?? "—"}</span>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setEditTarget(row)}>Edit</Button>
                          <Button size="sm" variant="ghost" className="text-destructive h-7 px-2 text-xs" onClick={() => setDeleteTarget(row)}>Delete</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!loading && data && (
                <CardFooter className="flex flex-col gap-3 border-t sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-muted-foreground order-2 text-center text-xs sm:order-1 sm:text-left">
                    {total > 0
                      ? `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} of ${total}`
                      : "No results"}
                  </p>
                  <div className="order-1 flex w-full justify-between gap-2 sm:order-2 sm:w-auto sm:justify-end">
                    <Button
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!data || page >= lastPage}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </CardFooter>
              )}
            </CardContent>
          </TabsContent>
        </Card>
      </Tabs>
      <EditCatalogueDialog
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => void load()}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete catalogue?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> (ID {deleteTarget?.id}).
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
