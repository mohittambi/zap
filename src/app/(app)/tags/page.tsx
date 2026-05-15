"use client";

import * as React from "react";
import { Download, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AppPageTitle } from "@/components/layout/app-page-shell";

type Tag = {
  id: number;
  name: string;
  tag_type: "operational" | "material";
};

type SkuRow = {
  sku_id: string;
  description: string | null;
  bulk_price: number;
  tags: Tag[];
};

type PageData = {
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: SkuRow[];
};

const TAG_TYPE_LABELS: Record<string, string> = {
  operational: "Operational",
  material: "Material",
};

function TagPill({
  tag,
  onRemove,
}: {
  tag: Tag;
  onRemove?: () => void;
}) {
  return (
    <Badge
      variant="outline"
      className={
        tag.tag_type === "material"
          ? "border-blue-300 bg-blue-50 text-blue-700"
          : "border-amber-300 bg-amber-50 text-amber-700"
      }
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 rounded-full hover:bg-black/10"
          aria-label={`Remove ${tag.name}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}

function TagMasterPanel({
  tags,
  onTagCreated,
  onTagDeleted,
}: {
  tags: Tag[];
  onTagCreated: (tag: Tag) => void;
  onTagDeleted: (id: number) => void;
}) {
  const [newName, setNewName] = React.useState("");
  const [newType, setNewType] = React.useState<"operational" | "material">("operational");
  const [adding, setAdding] = React.useState(false);

  async function addTag() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const tag = await apiFetch<Tag>("/api/sku-tags", {
        method: "POST",
        body: JSON.stringify({ name, tag_type: newType }),
      });
      onTagCreated(tag);
      setNewName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create tag");
    } finally {
      setAdding(false);
    }
  }

  async function deleteTag(id: number) {
    try {
      await apiFetch(`/api/sku-tags/${id}`, { method: "DELETE" });
      onTagDeleted(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete tag");
    }
  }

  const operational = tags.filter((t) => t.tag_type === "operational");
  const material = tags.filter((t) => t.tag_type === "material");

  return (
    <div className="flex w-72 shrink-0 flex-col gap-4 rounded-lg border p-4">
      <p className="text-sm font-semibold">Tag definitions</p>

      {(["operational", "material"] as const).map((type) => (
        <div key={type}>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {TAG_TYPE_LABELS[type]}
          </p>
          <div className="flex flex-wrap gap-1">
            {(type === "operational" ? operational : material).map((tag) => (
              <TagPill key={tag.id} tag={tag} onRemove={() => deleteTag(tag.id)} />
            ))}
          </div>
        </div>
      ))}

      <div className="mt-2 flex flex-col gap-2 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">Add tag</p>
        <Input
          placeholder="Tag name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void addTag();
          }}
          className="h-8 text-sm"
        />
        <div className="flex gap-1">
          {(["operational", "material"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setNewType(t)}
              className={
                newType === t
                  ? "flex-1 rounded border px-2 py-1 text-xs font-medium " +
                    (t === "material"
                      ? "border-blue-300 bg-blue-100 text-blue-700"
                      : "border-amber-300 bg-amber-100 text-amber-700")
                  : "flex-1 rounded border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              }
            >
              {TAG_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => void addTag()} disabled={adding || !newName.trim()}>
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>
    </div>
  );
}

export default function TagsPage() {
  const [tags, setTags] = React.useState<Tag[]>([]);
  const [skuData, setSkuData] = React.useState<PageData | null>(null);
  const [keyword, setKeyword] = React.useState("");
  const [draft, setDraft] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [savingFor, setSavingFor] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiFetch<Tag[]>("/api/sku-tags")
      .then(setTags)
      .catch(() => toast.error("Failed to load tags"));
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), count: "50" });
      if (keyword) params.set("search_keyword", keyword);
      const data = await apiFetch<PageData>(
        `/api/listings/by_page_v4?${params.toString()}`
      );
      // Enrich each row with tags (bulk fetch via existing tag assignments)
      const skuIds = data.content.map((r) => r.sku_id);
      // Get tags for all skus in one shot via separate calls (simple approach)
      const tagMap: Record<string, Tag[]> = {};
      await Promise.all(
        skuIds.map(async (sku_id) => {
          const skuTags = await apiFetch<Tag[]>(
            `/api/listings/sku/${encodeURIComponent(sku_id)}/tags`
          );
          tagMap[sku_id] = skuTags;
        })
      );
      setSkuData({
        ...data,
        content: data.content.map((r) => ({ ...r, tags: tagMap[r.sku_id] ?? [] })),
      });
    } catch {
      toast.error("Failed to load SKUs");
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function search() {
    setKeyword(draft);
    setPage(1);
  }

  async function toggleTag(skuId: string, tag: Tag) {
    const row = skuData?.content.find((r) => r.sku_id === skuId);
    if (!row) return;
    const has = row.tags.some((t) => t.id === tag.id);
    const newIds = has
      ? row.tags.filter((t) => t.id !== tag.id).map((t) => t.id)
      : [...row.tags.map((t) => t.id), tag.id];

    setSavingFor(skuId);
    try {
      const updated = await apiFetch<Tag[]>(
        `/api/listings/sku/${encodeURIComponent(skuId)}/tags`,
        { method: "POST", body: JSON.stringify({ tag_ids: newIds }) }
      );
      setSkuData((prev) =>
        prev
          ? {
              ...prev,
              content: prev.content.map((r) =>
                r.sku_id === skuId ? { ...r, tags: updated } : r
              ),
            }
          : prev
      );
    } catch {
      toast.error("Failed to update tags");
    } finally {
      setSavingFor(null);
    }
  }

  function downloadSheet() {
    window.location.href = "/api/sku-tags/export";
  }

  const total = skuData?.total ?? 0;
  const totalPages = Math.ceil(total / 50);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <AppPageTitle title="SKU Tags" />
        <Button variant="outline" onClick={downloadSheet}>
          <Download className="mr-2 h-4 w-4" />
          Share master sheet
        </Button>
      </div>

      <div className="flex gap-4 items-start">
        <TagMasterPanel
          tags={tags}
          onTagCreated={(tag) => setTags((prev) => [...prev, tag])}
          onTagDeleted={(id) => setTags((prev) => prev.filter((t) => t.id !== id))}
        />

        <div className="flex flex-1 flex-col gap-3 min-w-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search SKU…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") search();
                }}
              />
            </div>
            <Button onClick={search} variant="secondary">
              Search
            </Button>
          </div>

          {total > 0 && (
            <p className="text-xs text-muted-foreground">
              {total.toLocaleString()} SKUs
            </p>
          )}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">SKU</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24 text-right">Price</TableHead>
                  <TableHead>Operational tags</TableHead>
                  <TableHead>Material tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((__, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : skuData?.content.map((row) => {
                      const opTags = tags.filter((t) => t.tag_type === "operational");
                      const matTags = tags.filter((t) => t.tag_type === "material");
                      const saving = savingFor === row.sku_id;
                      return (
                        <TableRow key={row.sku_id} className={saving ? "opacity-60" : ""}>
                          <TableCell className="font-mono text-xs font-semibold">
                            {row.sku_id}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                            {row.description ?? "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {row.bulk_price ? `₹${row.bulk_price.toLocaleString()}` : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {opTags.map((tag) => {
                                const active = row.tags.some((t) => t.id === tag.id);
                                return (
                                  <button
                                    key={tag.id}
                                    disabled={saving}
                                    onClick={() => void toggleTag(row.sku_id, tag)}
                                    className={
                                      "rounded-full border px-2 py-0.5 text-xs font-medium transition-colors " +
                                      (active
                                        ? "border-amber-300 bg-amber-100 text-amber-700"
                                        : "border-dashed border-muted-foreground/30 text-muted-foreground hover:border-amber-300 hover:text-amber-600")
                                    }
                                  >
                                    {tag.name}
                                  </button>
                                );
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {matTags.map((tag) => {
                                const active = row.tags.some((t) => t.id === tag.id);
                                return (
                                  <button
                                    key={tag.id}
                                    disabled={saving}
                                    onClick={() => void toggleTag(row.sku_id, tag)}
                                    className={
                                      "rounded-full border px-2 py-0.5 text-xs font-medium transition-colors " +
                                      (active
                                        ? "border-blue-300 bg-blue-100 text-blue-700"
                                        : "border-dashed border-muted-foreground/30 text-muted-foreground hover:border-blue-300 hover:text-blue-600")
                                    }
                                  >
                                    {tag.name}
                                  </button>
                                );
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
