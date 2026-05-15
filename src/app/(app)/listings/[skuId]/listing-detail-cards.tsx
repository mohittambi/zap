"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/api-browser";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
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

// ── Bin combobox ──────────────────────────────────────────────────────────────

type BinLocation = {
  warehouse_id: number;
  bin_id: string;
  bin_total_qty: number;
  sku_qty: number;
  already_assigned: boolean;
};

function BinCombobox({
  locations,
  loading,
  selected,
  onSelect,
  onAdd,
  onCancel,
  adding,
}: {
  locations: BinLocation[];
  loading: boolean;
  selected: string;
  onSelect: (v: string) => void;
  onAdd: () => void;
  onCancel: () => void;
  adding: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter(
      (loc) =>
        loc.bin_id.toLowerCase().includes(q) ||
        String(loc.warehouse_id).includes(q)
    );
  }, [locations, query]);

  const selectedLoc = React.useMemo(
    () => locations.find((l) => `${l.warehouse_id}|${l.bin_id}` === selected) ?? null,
    [locations, selected]
  );

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setOpen(true);
    if (selected) onSelect(""); // clear selection when user types again
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      // Select first non-assigned match on Enter
      const first = filtered.find((l) => !l.already_assigned);
      if (first) {
        onSelect(`${first.warehouse_id}|${first.bin_id}`);
        setQuery(first.bin_id);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function handlePick(loc: BinLocation) {
    if (loc.already_assigned) return;
    onSelect(`${loc.warehouse_id}|${loc.bin_id}`);
    setQuery(loc.bin_id);
    setOpen(false);
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <p className="text-xs font-medium">Add Bin Location</p>

      <div className="space-y-1" ref={containerRef}>
        <Label className="text-xs">Search bin</Label>
        <div className="relative">
          <Input
            value={query}
            onChange={handleInputChange}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Type bin ID or warehouse…"
            className="h-9 font-mono text-sm"
            disabled={loading}
          />
          {open && !loading && filtered.length > 0 && (
            <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover shadow-md text-sm">
              {filtered.map((loc) => {
                const key = `${loc.warehouse_id}|${loc.bin_id}`;
                const isSelected = selected === key;
                return (
                  <li
                    key={key}
                    onMouseDown={(e) => { e.preventDefault(); handlePick(loc); }}
                    className={cn(
                      "flex items-start justify-between gap-2 px-3 py-2 cursor-pointer",
                      loc.already_assigned
                        ? "cursor-not-allowed opacity-40"
                        : isSelected
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="min-w-0">
                      <span className="font-mono font-semibold">{loc.bin_id}</span>
                      <span className="ml-2 text-xs opacity-70">WH {loc.warehouse_id}</span>
                      {loc.already_assigned && (
                        <span className="ml-2 text-xs italic">already assigned</span>
                      )}
                    </div>
                    <div className="shrink-0 text-right text-xs opacity-70 tabular-nums">
                      <div>this SKU: {loc.sku_qty}</div>
                      <div>bin total: {loc.bin_total_qty}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {open && !loading && filtered.length === 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md">
              No bins match "{query}"
            </div>
          )}
        </div>
        {selectedLoc && (
          <p className="text-xs text-muted-foreground">
            Selected: <span className="font-mono font-medium">{selectedLoc.bin_id}</span> · WH {selectedLoc.warehouse_id} · this SKU: {selectedLoc.sku_qty} · bin total: {selectedLoc.bin_total_qty}
          </p>
        )}
        {loading && <p className="text-xs text-muted-foreground">Loading bins…</p>}
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={onAdd} disabled={adding || !selected}>
          {adding ? "Adding…" : "Add"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function AvailableQuantityCard({
  listing,
  skuId,
  onSaved,
}: Readonly<{ listing: ListingDetail; skuId: string; onSaved: (l: ListingDetail) => void }>) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("bins", "manage");

  const bins = listing.bins ?? [];
  // Always derive from live bin data, not the stale listings.available_quantity column.
  const avail = bins.reduce((s, b) => s + Number(b.available_quantity ?? 0), 0);

  const [isEditing, setIsEditing] = React.useState(false);
  const [qtyDraft, setQtyDraft] = React.useState<Record<number, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [qtyErrors, setQtyErrors] = React.useState<Record<number, string>>({});

  // ── Add Bin state ─────────────────────────────────────────────────────────
  type BinLocation = { warehouse_id: number; bin_id: string; bin_total_qty: number; sku_qty: number; already_assigned: boolean };
  const [showAddBin, setShowAddBin] = React.useState(false);
  const [binLocations, setBinLocations] = React.useState<BinLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = React.useState(false);
  const [selectedLocation, setSelectedLocation] = React.useState<string>(""); // "warehouseId|binId"
  const [addingBin, setAddingBin] = React.useState(false);

  async function loadBinLocations() {
    setLocationsLoading(true);
    try {
      const data = await apiFetch<BinLocation[]>(
        `/api/bins/locations?sku_id=${encodeURIComponent(skuId)}`
      );
      setBinLocations(data);
    } catch {
      setBinLocations([]);
    } finally {
      setLocationsLoading(false);
    }
  }

  function handleOpenAddBin() {
    setSelectedLocation("");
    setShowAddBin(true);
    void loadBinLocations();
  }

  async function handleAddBin() {
    const [whRaw, binRaw] = selectedLocation.split("|");
    const wid = Number(whRaw);
    const bid = binRaw?.trim();
    if (!wid || !bid) {
      toast.error("Please select a bin from the dropdown.");
      return;
    }
    setAddingBin(true);
    try {
      await apiFetch("/api/bins", {
        method: "POST",
        body: JSON.stringify({ warehouse_id: wid, sku_id: skuId, bin_id: bid }),
      });
      toast.success(`Bin "${bid}" added for this SKU.`);
      setSelectedLocation("");
      setShowAddBin(false);
      const updated = await apiFetch<ListingDetail>(
        `/api/listings/sku/${encodeURIComponent(skuId)}`
      );
      onSaved(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add bin");
    } finally {
      setAddingBin(false);
    }
  }

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
          {canManage && !isEditing && (
            <Button size="sm" variant="outline" onClick={handleOpenAddBin}>
              <Plus className="mr-1 h-3 w-3" />
              Add Bin
            </Button>
          )}
          {isEditing ? (
            <>
              <Button size="sm" variant="default" disabled={saving} onClick={() => void handleSaveQty()}>
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
      <CardContent className="space-y-4">
        {canManage && showAddBin && (
          <BinCombobox
            locations={binLocations}
            loading={locationsLoading}
            selected={selectedLocation}
            onSelect={setSelectedLocation}
            onAdd={() => void handleAddBin()}
            onCancel={() => setShowAddBin(false)}
            adding={addingBin}
          />
        )}
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
            <p className="text-muted-foreground text-sm">No bin locations. {canManage ? "Use \"Add Bin\" to create one." : ""}</p>
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
