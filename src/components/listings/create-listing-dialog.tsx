"use client";

import * as React from "react";
import { Check, ChevronDown, ChevronRight, Loader2, Plus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SKU_ID_RE } from "@/lib/listingCreate";

type CategoryOption = { name: string; count: number };

type CreateListingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (skuId: string) => void;
};

function SectionToggle({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/80">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium"
        onClick={onToggle}
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        {title}
      </button>
      {open ? <div className="space-y-3 border-t border-border/80 px-3 py-3">{children}</div> : null}
    </div>
  );
}

export function CreateListingDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateListingDialogProps) {
  const [skuId, setSkuId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [skuType, setSkuType] = React.useState("SINGLE");
  const [opsTag, setOpsTag] = React.useState("");
  const [inventoryBypass, setInventoryBypass] = React.useState("NO");
  const [bulkPrice, setBulkPrice] = React.useState("");
  const [actualWeight, setActualWeight] = React.useState("");
  const [dimension, setDimension] = React.useState("");
  const [constituents, setConstituents] = React.useState("1");
  const [imgHd, setImgHd] = React.useState("");
  const [imgWhite, setImgWhite] = React.useState("");
  const [imgWdim, setImgWdim] = React.useState("");
  const [imgLink1, setImgLink1] = React.useState("");
  const [imgLink2, setImgLink2] = React.useState("");
  const [showClassification, setShowClassification] = React.useState(false);
  const [showPhysical, setShowPhysical] = React.useState(false);
  const [showImages, setShowImages] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [categories, setCategories] = React.useState<CategoryOption[]>([]);
  const [skuCheck, setSkuCheck] = React.useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");

  React.useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const res = await apiFetch<{ categories: CategoryOption[] }>(
          "/api/listings/categories?limit=100"
        );
        setCategories(res.categories.filter((c) => c.name !== "(uncategorised)"));
      } catch {
        setCategories([]);
      }
    })();
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      setSkuId("");
      setDescription("");
      setCategory("");
      setSkuType("SINGLE");
      setOpsTag("");
      setInventoryBypass("NO");
      setBulkPrice("");
      setActualWeight("");
      setDimension("");
      setConstituents("1");
      setImgHd("");
      setImgWhite("");
      setImgWdim("");
      setImgLink1("");
      setImgLink2("");
      setShowClassification(false);
      setShowPhysical(false);
      setShowImages(false);
      setSkuCheck("idle");
    }
  }, [open]);

  React.useEffect(() => {
    const trimmed = skuId.trim();
    if (!trimmed) {
      setSkuCheck("idle");
      return;
    }
    if (!SKU_ID_RE.test(trimmed)) {
      setSkuCheck("invalid");
      return;
    }

    setSkuCheck("checking");
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await apiFetch(`/api/listings/sku/${encodeURIComponent(trimmed)}`);
          setSkuCheck("taken");
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          if (msg.toLowerCase().includes("not found") || msg.includes("404")) {
            setSkuCheck("available");
          } else {
            setSkuCheck("idle");
          }
        }
      })();
    }, 400);

    return () => window.clearTimeout(timer);
  }, [skuId]);

  const canSubmit =
    skuId.trim().length > 0 &&
    description.trim().length > 0 &&
    SKU_ID_RE.test(skuId.trim()) &&
    skuCheck === "available" &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        sku_id: skuId.trim(),
        description: description.trim(),
        sku_type: skuType,
        inventory_bypass_on: inventoryBypass,
      };
      if (category.trim()) body.category = category.trim();
      if (opsTag.trim()) body.ops_tag = opsTag.trim();
      if (bulkPrice.trim()) body.bulk_price = Number(bulkPrice);
      if (actualWeight.trim()) body.actual_weight = Number(actualWeight);
      if (dimension.trim()) body.dimension = dimension.trim();
      if (constituents.trim() && constituents !== "1") {
        body.no_of_constituents = Number(constituents);
      }
      if (imgHd.trim()) body.img_hd = imgHd.trim();
      if (imgWhite.trim()) body.img_white = imgWhite.trim();
      if (imgWdim.trim()) body.img_wdim = imgWdim.trim();
      if (imgLink1.trim()) body.img_link1 = imgLink1.trim();
      if (imgLink2.trim()) body.img_link2 = imgLink2.trim();

      await apiFetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      toast.success(`Listing ${skuId.trim()} created`);
      onCreated(skuId.trim());
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create listing");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New master listing</DialogTitle>
          <DialogDescription>
            Create a Zap-managed master SKU. Required fields are SKU ID and description. For many
            SKUs, use{" "}
            <a
              href="/listings/bulk"
              className="text-primary font-medium underline-offset-2 hover:underline"
            >
              Bulk Operations → Create Master Listings
            </a>
            .
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <div className="space-y-2">
            <Label htmlFor="create-sku-id">SKU ID</Label>
            <div className="relative">
              <Input
                id="create-sku-id"
                value={skuId}
                onChange={(e) => setSkuId(e.target.value)}
                placeholder="e.g. ZAP-MYSKU-001"
                className="font-mono pr-9"
                autoComplete="off"
              />
              <div className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
                {skuCheck === "checking" ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : skuCheck === "available" ? (
                  <Check className="size-4 text-green-600" />
                ) : skuCheck === "taken" || skuCheck === "invalid" ? (
                  <XCircle className="size-4 text-destructive" />
                ) : null}
              </div>
            </div>
            {skuCheck === "taken" ? (
              <p className="text-destructive text-xs">This SKU already exists.</p>
            ) : skuCheck === "invalid" ? (
              <p className="text-destructive text-xs">
                Use letters, numbers, dots, underscores, or hyphens (max 100 chars).
              </p>
            ) : skuCheck === "available" ? (
              <p className="text-xs text-green-700">SKU is available.</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-description">Description</Label>
            <textarea
              id="create-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              className={cn(
                "border-input bg-background ring-offset-background placeholder:text-muted-foreground",
                "focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm",
                "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              )}
              placeholder="Product title or short description"
            />
          </div>

          <SectionToggle
            title="Classification (optional)"
            open={showClassification}
            onToggle={() => setShowClassification((v) => !v)}
          >
            <div className="space-y-2">
              <Label htmlFor="create-category">Category</Label>
              <Input
                id="create-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                list="listing-category-options"
                placeholder="Pick or type a category"
              />
              <datalist id="listing-category-options">
                {categories.map((c) => (
                  <option key={c.name} value={c.name} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-sku-type">SKU type</Label>
                <select
                  id="create-sku-type"
                  value={skuType}
                  onChange={(e) => setSkuType(e.target.value)}
                  className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                >
                  <option value="SINGLE">SINGLE</option>
                  <option value="PACK">PACK</option>
                  <option value="COMBO">COMBO</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-inventory-bypass">Inventory bypass</Label>
                <select
                  id="create-inventory-bypass"
                  value={inventoryBypass}
                  onChange={(e) => setInventoryBypass(e.target.value)}
                  className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                >
                  <option value="NO">NO</option>
                  <option value="YES">YES</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-ops-tag">Ops tag</Label>
              <Input
                id="create-ops-tag"
                value={opsTag}
                onChange={(e) => setOpsTag(e.target.value)}
                placeholder="e.g. SM"
              />
            </div>
          </SectionToggle>

          <SectionToggle
            title="Physical / pricing (optional)"
            open={showPhysical}
            onToggle={() => setShowPhysical((v) => !v)}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-bulk-price">Bulk price</Label>
                <Input
                  id="create-bulk-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={bulkPrice}
                  onChange={(e) => setBulkPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-weight">Actual weight (kg)</Label>
                <Input
                  id="create-weight"
                  type="number"
                  min={0}
                  step="0.01"
                  value={actualWeight}
                  onChange={(e) => setActualWeight(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-dimension">Dimension</Label>
                <Input
                  id="create-dimension"
                  value={dimension}
                  onChange={(e) => setDimension(e.target.value)}
                  placeholder="30x20x15 cm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-constituents">Constituents</Label>
                <Input
                  id="create-constituents"
                  type="number"
                  min={1}
                  step={1}
                  value={constituents}
                  onChange={(e) => setConstituents(e.target.value)}
                />
              </div>
            </div>
          </SectionToggle>

          <SectionToggle
            title="Images (optional)"
            open={showImages}
            onToggle={() => setShowImages((v) => !v)}
          >
            <div className="space-y-2">
              <Label htmlFor="create-img-hd">HD image URL</Label>
              <Input
                id="create-img-hd"
                type="url"
                value={imgHd}
                onChange={(e) => setImgHd(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-img-white">White-background image URL</Label>
              <Input
                id="create-img-white"
                type="url"
                value={imgWhite}
                onChange={(e) => setImgWhite(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-img-wdim">Image with dimensions URL</Label>
              <Input
                id="create-img-wdim"
                type="url"
                value={imgWdim}
                onChange={(e) => setImgWdim(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-img-link1">Additional image 1 URL</Label>
                <Input
                  id="create-img-link1"
                  type="url"
                  value={imgLink1}
                  onChange={(e) => setImgLink1(e.target.value)}
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-img-link2">Additional image 2 URL</Label>
                <Input
                  id="create-img-link2"
                  type="url"
                  value={imgLink2}
                  onChange={(e) => setImgLink2(e.target.value)}
                  placeholder="https://…"
                />
              </div>
            </div>
          </SectionToggle>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit} className="gap-2">
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Create listing
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
