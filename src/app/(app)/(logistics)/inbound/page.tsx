"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { Badge } from "@/components/ui/badge";

type VendorSpecialty = {
  id: number;
  vendor_id: number;
  vendor_speciality: string;
};

type Vendor = {
  id: number;
  vendor_name: string;
  vendor_city?: string;
  vendor_gstin?: string;
  specialties?: VendorSpecialty[];
};

function matchesSearch(v: Vendor, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const idStr = String(v.id);
  const name = (v.vendor_name ?? "").toLowerCase();
  const city = (v.vendor_city ?? "").toLowerCase();
  const gstin = (v.vendor_gstin ?? "").toLowerCase();
  const specs = (v.specialties ?? []).some((sp) =>
    (sp.vendor_speciality ?? "").toLowerCase().includes(s)
  );
  return (
    idStr.includes(s) ||
    name.includes(s) ||
    city.includes(s) ||
    gstin.includes(s) ||
    specs
  );
}

export default function InboundVendorsPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("vendors", "create");
  const canDelete = hasPermission("vendors", "delete");

  const [rows, setRows] = React.useState<Vendor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [applied, setApplied] = React.useState("");

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createSubmitting, setCreateSubmitting] = React.useState(false);
  const [formId, setFormId] = React.useState("");
  const [formName, setFormName] = React.useState("");
  const [formAddress, setFormAddress] = React.useState("");
  const [formCity, setFormCity] = React.useState("");
  const [formState, setFormState] = React.useState("");
  const [formPostal, setFormPostal] = React.useState("");
  const [formGstin, setFormGstin] = React.useState("");
  const [formPhone, setFormPhone] = React.useState("");

  const [deleteTarget, setDeleteTarget] = React.useState<Vendor | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Vendor[]>("/api/vendors/all");
      setRows(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load vendors");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = React.useMemo(
    () => rows.filter((v) => matchesSearch(v, applied)),
    [rows, applied]
  );

  function resetCreateForm() {
    setFormId("");
    setFormName("");
    setFormAddress("");
    setFormCity("");
    setFormState("");
    setFormPostal("");
    setFormGstin("");
    setFormPhone("");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/vendors/${deleteTarget.id}`, { method: "DELETE" });
      toast.success(`Vendor "${deleteTarget.vendor_name}" deleted`);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function submitCreate() {
    if (!formName.trim()) {
      toast.error("Vendor name is required");
      return;
    }
    setCreateSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        vendor_name: formName.trim(),
        vendor_address_line: formAddress.trim() || undefined,
        vendor_city: formCity.trim() || undefined,
        vendor_state: formState.trim() || undefined,
        vendor_postal_code: formPostal.trim() || undefined,
        vendor_gstin: formGstin.trim() || undefined,
        vendor_contact_number: formPhone.trim() || undefined,
      };
      if (formId.trim()) {
        const n = Number.parseInt(formId.trim(), 10);
        if (!Number.isNaN(n) && n > 0) body.id = n;
      }
      const created = await apiFetch<Vendor>("/api/vendors", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success("Vendor created");
      setCreateOpen(false);
      resetCreateForm();
      await load();
      router.push(`/inbound/vendors/${created.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreateSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-2 py-4 md:px-4">
      <AppPageTitle
        title="Inbound"
        description="Select a vendor to review SKUs and stock levels. Search by name, city, GSTIN, specialty, or ID."
      />

      <Card className="border-primary/10 shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex w-full flex-col gap-2 sm:max-w-md">
            <Label
              htmlFor="inbound-vendor-search"
              className="text-muted-foreground text-xs font-medium"
            >
              Search vendors
            </Label>
            <div className="flex gap-2">
              <Input
                id="inbound-vendor-search"
                placeholder="Name, city, GSTIN, or vendor ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setApplied(search);
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => setApplied(search)}
              >
                Apply
              </Button>
            </div>
          </div>
          {canCreate ? (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              Add vendor
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 px-6 py-4 sm:grid-cols-2 lg:grid-cols-3">
              {["sk1", "sk2", "sk3", "sk4", "sk5", "sk6"].map((k) => (
                <Skeleton key={k} className="h-28 w-full rounded-lg" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-8">
              <EmptyState
                title="No vendors"
                description="Run vendor sync, seed the database, or add a vendor."
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-8">
              <EmptyState
                title="No matches"
                description="Try a different search term or clear the filter."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 px-6 pb-6 pt-2 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((v) => {
                const initials = (v.vendor_name ?? "?")
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase() ?? "")
                  .join("");
                return (
                  <Link
                    key={v.id}
                    href={`/inbound/vendors/${v.id}`}
                    className="group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground group-hover:text-primary truncate font-semibold leading-snug transition-colors">
                          {v.vendor_name ?? "—"}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          ID{" "}
                          <span className="font-mono">{v.id}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 text-xs">
                      {v.vendor_city ? (
                        <div className="text-muted-foreground flex items-center gap-1.5">
                          <svg
                            className="h-3 w-3 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                            <circle cx="12" cy="9" r="2.5" />
                          </svg>
                          <span className="truncate">{v.vendor_city}</span>
                        </div>
                      ) : null}
                      {v.vendor_gstin ? (
                        <div className="text-muted-foreground flex items-center gap-1.5">
                          <svg
                            className="h-3 w-3 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <rect x="2" y="7" width="20" height="14" rx="2" />
                            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                          </svg>
                          <span className="font-mono tracking-wide">
                            {v.vendor_gstin}
                          </span>
                        </div>
                      ) : null}
                      {(v.specialties?.length ?? 0) > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {(v.specialties ?? []).map((sp) => (
                            <Badge
                              key={sp.id}
                              variant="secondary"
                              className="bg-primary/10 text-primary border-primary/20 max-w-full truncate px-2 py-0 text-[10px] font-medium"
                              title={sp.vendor_speciality}
                            >
                              {sp.vendor_speciality}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {canDelete ? (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive absolute right-3 top-3 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        title="Delete vendor"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteTarget(v);
                        }}
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete vendor?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.vendor_name}</strong> (ID {deleteTarget?.id}).
              This cannot be undone. Vendors with existing purchase orders cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 sm:justify-end">
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

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Add vendor</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[min(70vh,520px)] gap-3 overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label htmlFor="nv-id">Vendor ID (optional)</Label>
              <Input
                id="nv-id"
                inputMode="numeric"
                placeholder="Leave blank to auto-assign"
                value={formId}
                onChange={(e) => setFormId(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nv-name">Vendor name</Label>
              <Input
                id="nv-name"
                placeholder="Required"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nv-addr">Address</Label>
              <Input
                id="nv-addr"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="nv-city">City</Label>
                <Input
                  id="nv-city"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nv-state">State</Label>
                <Input
                  id="nv-state"
                  value={formState}
                  onChange={(e) => setFormState(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nv-postal">Postal code</Label>
              <Input
                id="nv-postal"
                value={formPostal}
                onChange={(e) => setFormPostal(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nv-gstin">GSTIN</Label>
              <Input
                id="nv-gstin"
                value={formGstin}
                onChange={(e) => setFormGstin(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nv-phone">Contact number</Label>
              <Input
                id="nv-phone"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex-row gap-3 sm:justify-end">
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
              onClick={() => void submitCreate()}
            >
              {createSubmitting ? "Saving…" : "Create vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
