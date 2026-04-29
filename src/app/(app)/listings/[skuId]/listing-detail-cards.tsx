"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ListingDetail } from "@/types/listing";

/** Merge bin PATCH responses into listing and recompute aggregated available qty. */
function mergeBinsIntoListing(
  listing: ListingDetail,
  binPatches: Array<{ id: number; available_quantity: number }>
): ListingDetail {
  const patchById = new Map(binPatches.map((b) => [b.id, b.available_quantity]));
  const bins = (listing.bins ?? []).map((b) =>
    patchById.has(b.id)
      ? { ...b, available_quantity: patchById.get(b.id)! }
      : b
  );
  const total = bins.reduce((s, bin) => s + Number(bin.available_quantity ?? 0), 0);
  return { ...listing, bins, available_quantity: total };
}

type ListingInfoDraft = {
  ops_tag: string;
  category: string;
  sku_type: string;
  bulk_price: string;
  no_of_constituents: string;
};

function buildInfoDraft(listing: ListingDetail): ListingInfoDraft {
  return {
    ops_tag: listing.ops_tag ?? "",
    category: listing.category ?? "",
    sku_type: listing.sku_type ?? "",
    bulk_price: listing.bulk_price != null ? String(listing.bulk_price) : "",
    no_of_constituents:
      listing.no_of_constituents != null ? String(listing.no_of_constituents) : "",
  };
}

export function ListingInfoCard({
  listing,
  skuId,
  onSaved,
}: Readonly<{ listing: ListingDetail; skuId: string; onSaved: (l: ListingDetail) => void }>) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<ListingInfoDraft>(() =>
    buildInfoDraft(listing)
  );
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<ListingInfoDraft>>({});

  React.useEffect(() => {
    if (!isEditing) {
      setDraft(buildInfoDraft(listing));
      setErrors({});
    }
  }, [listing, isEditing]);

  function validateInfo(d: ListingInfoDraft): Partial<ListingInfoDraft> {
    const errs: Partial<ListingInfoDraft> = {};
    if (d.bulk_price !== "" && d.bulk_price !== null) {
      const n = Number(d.bulk_price);
      if (Number.isNaN(n) || n < 0) errs.bulk_price = "Must be a non-negative number";
    }
    if (d.no_of_constituents !== "" && d.no_of_constituents !== null) {
      const n = Number(d.no_of_constituents);
      if (Number.isNaN(n) || n < 0 || !Number.isInteger(n)) {
        errs.no_of_constituents = "Must be a non-negative integer";
      }
    }
    return errs;
  }

  function handleCancel() {
    setIsEditing(false);
    setDraft(buildInfoDraft(listing));
    setErrors({});
  }

  async function handleSave() {
    const errs = validateInfo(draft);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string | number | null> = {
        ops_tag: draft.ops_tag.trim() || null,
        category: draft.category.trim() || null,
        sku_type: draft.sku_type.trim() || null,
        bulk_price: draft.bulk_price !== "" ? Number(draft.bulk_price) : null,
        no_of_constituents:
          draft.no_of_constituents !== "" ? Number(draft.no_of_constituents) : null,
      };
      const updated = await apiFetch<ListingDetail>(
        `/api/listings/sku/${encodeURIComponent(skuId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      toast.success("Listing info saved");
      setIsEditing(false);
      onSaved(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-primary text-2xl font-semibold">{listing.sku_id}</CardTitle>
        <p className="text-muted-foreground text-sm">
          <span className="font-medium text-foreground">Description</span>{" "}
          {listing.description ?? "—"}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Inventory SKU ID</Label>
              <p className="font-mono text-sm">{listing.inventory_sku_id ?? "—"}</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ops_tag" className="text-xs font-medium text-muted-foreground">
                Ops Tag
              </Label>
              <Input
                id="ops_tag"
                value={draft.ops_tag}
                onChange={(e) => setDraft((d) => ({ ...d, ops_tag: e.target.value }))}
                placeholder="Ops Tag"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Master SKU ID</Label>
              <p className="font-mono text-sm">{listing.master_sku ?? "—"}</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="bulk_price" className="text-xs font-medium text-muted-foreground">
                Bulk Transfer Price
              </Label>
              <Input
                id="bulk_price"
                type="number"
                min="0"
                step="0.01"
                value={draft.bulk_price}
                onChange={(e) => setDraft((d) => ({ ...d, bulk_price: e.target.value }))}
                placeholder="0"
                className={cn("h-8 text-sm", errors.bulk_price && "border-destructive")}
              />
              {errors.bulk_price && <p className="text-destructive text-xs">{errors.bulk_price}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Pack-Combo SKU ID</Label>
              <p className="font-mono text-sm">{listing.pack_combo_sku_id ?? "—"}</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="category" className="text-xs font-medium text-muted-foreground">
                Category
              </Label>
              <Input
                id="category"
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                placeholder="Category"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sku_type" className="text-xs font-medium text-muted-foreground">
                SKU Type
              </Label>
              <Input
                id="sku_type"
                value={draft.sku_type}
                onChange={(e) => setDraft((d) => ({ ...d, sku_type: e.target.value }))}
                placeholder="SINGLE / PACK / COMBO"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="no_of_constituents"
                className="text-xs font-medium text-muted-foreground"
              >
                Number of Constituents
              </Label>
              <Input
                id="no_of_constituents"
                type="number"
                min="0"
                step="1"
                value={draft.no_of_constituents}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    no_of_constituents: e.target.value,
                  }))
                }
                placeholder="1"
                className={cn(
                  "h-8 text-sm",
                  errors.no_of_constituents && "border-destructive"
                )}
              />
              {errors.no_of_constituents && (
                <p className="text-destructive text-xs">{errors.no_of_constituents}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailCell label="Inventory SKU ID" value={listing.inventory_sku_id} />
            <DetailCell label="Ops Tag" value={listing.ops_tag} />
            <DetailCell label="Master SKU ID" value={listing.master_sku} />
            <DetailCell
              label="Bulk Transfer Price"
              value={listing.bulk_price != null ? String(listing.bulk_price) : "—"}
            />
            <DetailCell label="Pack-Combo SKU ID" value={listing.pack_combo_sku_id} />
            <DetailCell label="Category" value={listing.category} />
            <DetailCell label="Sku Type" value={listing.sku_type ?? "—"} />
            <DetailCell
              label="Number of Constituents"
              value={listing.no_of_constituents != null ? String(listing.no_of_constituents) : "—"}
            />
          </div>
        )}

        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button size="sm" variant="default" disabled={saving} onClick={() => void handleSave()}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button size="sm" variant="outline" disabled={saving} onClick={handleCancel}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="default" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
              <Button size="sm" variant="outline" disabled>
                Cancel
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type BinQtyInputProps = {
  binId: number;
  binLabel: string;
  value: string;
  error?: string;
  onChangeBin: (binId: number, value: string) => void;
};

const BinQtyInput = React.memo(function BinQtyInput({
  binId,
  binLabel,
  value,
  error,
  onChangeBin,
}: BinQtyInputProps) {
  return (
    <div className="rounded-lg border bg-card p-4 text-center shadow-sm">
      <p className="font-mono text-sm font-semibold">{binLabel}</p>
      <div className="mt-2 space-y-1">
        <Input
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={(e) => onChangeBin(binId, e.target.value)}
          className={cn("h-9 text-center text-lg tabular-nums", error && "border-destructive")}
        />
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>
    </div>
  );
});

type BinQtyViewProps = Readonly<{ binLabel: string; quantity: number }>;

const BinQtyView = React.memo(function BinQtyView({ binLabel, quantity }: BinQtyViewProps) {
  return (
    <div className="rounded-lg border bg-card p-4 text-center shadow-sm">
      <p className="font-mono text-sm font-semibold">{binLabel}</p>
      <p className="text-primary mt-2 text-2xl tabular-nums">{quantity}</p>
    </div>
  );
});

export function AvailableQuantityCard({
  listing,
  onSaved,
}: Readonly<{ listing: ListingDetail; onSaved: (l: ListingDetail) => void }>) {
  const avail = Number(listing.available_quantity ?? 0);
  const bins = listing.bins ?? [];

  const [isEditing, setIsEditing] = React.useState(false);
  const [qtyDraft, setQtyDraft] = React.useState<Record<number, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [qtyErrors, setQtyErrors] = React.useState<Record<number, string>>({});

  const onChangeBin = React.useCallback((binId: number, value: string) => {
    setQtyDraft((d) => ({ ...d, [binId]: value }));
  }, []);

  function handleStartEdit() {
    const d: Record<number, string> = {};
    for (const b of bins) {
      d[b.id] = String(b.available_quantity ?? 0);
    }
    setQtyDraft(d);
    setQtyErrors({});
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
    setQtyDraft({});
    setQtyErrors({});
  }

  async function handleSaveQty() {
    const errs: Record<number, string> = {};
    for (const bin of bins) {
      const raw = qtyDraft[bin.id] ?? "";
      const n = Number(raw);
      if (raw === "" || Number.isNaN(n) || n < 0 || !Number.isInteger(n)) {
        errs[bin.id] = "Must be a non-negative integer";
      }
    }
    if (Object.keys(errs).length > 0) {
      setQtyErrors(errs);
      return;
    }
    setSaving(true);
    try {
      const patches: Array<{ id: number; available_quantity: number }> = [];
      await Promise.all(
        bins.map(async (bin) => {
          const row = await apiFetch<{ id: number; available_quantity: number }>(
            `/api/bins/${bin.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sku_id: listing.sku_id,
                available_quantity: Number(qtyDraft[bin.id]),
              }),
            }
          );
          patches.push({ id: row.id, available_quantity: row.available_quantity });
        })
      );
      toast.success("Quantities saved");
      setIsEditing(false);
      const merged = mergeBinsIntoListing(listing, patches);
      onSaved(merged);
      setQtyDraft({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save quantities");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-primary text-base">
          AVAILABLE QUANTITY : {avail}
        </CardTitle>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                size="sm"
                variant="default"
                disabled={saving}
                onClick={() => void handleSaveQty()}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button size="sm" variant="outline" disabled={saving} onClick={handleCancel}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="default" onClick={handleStartEdit}>
                Edit
              </Button>
              <Button size="sm" variant="outline" disabled>
                Cancel
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {isEditing
            ? bins.map((b) => (
                <BinQtyInput
                  key={b.id}
                  binId={b.id}
                  binLabel={b.bin_id}
                  value={
                    qtyDraft[b.id] !== undefined
                      ? qtyDraft[b.id]
                      : String(b.available_quantity ?? 0)
                  }
                  error={qtyErrors[b.id]}
                  onChangeBin={onChangeBin}
                />
              ))
            : bins.map((b) => (
                <BinQtyView key={b.id} binLabel={b.bin_id} quantity={b.available_quantity} />
              ))}
          {bins.length === 0 && (
            <p className="text-muted-foreground text-sm">No bin locations.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DetailCell({ label, value }: Readonly<{ label: string; value?: string | null }>) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="font-mono text-sm break-all">{value ?? "—"}</p>
    </div>
  );
}
