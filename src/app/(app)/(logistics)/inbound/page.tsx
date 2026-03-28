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

type Vendor = {
  id: number;
  vendor_name: string;
  vendor_city?: string;
  vendor_gstin?: string;
};

function matchesSearch(v: Vendor, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const idStr = String(v.id);
  const name = (v.vendor_name ?? "").toLowerCase();
  const city = (v.vendor_city ?? "").toLowerCase();
  const gstin = (v.vendor_gstin ?? "").toLowerCase();
  return (
    idStr.includes(s) ||
    name.includes(s) ||
    city.includes(s) ||
    gstin.includes(s)
  );
}

export default function InboundVendorsPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("vendors", "create");

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
        description="Select a vendor to review SKUs and stock levels. Search by name, city, GSTIN, or ID."
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
            <div className="space-y-2 px-6 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-8">
              <EmptyState
                title="No vendors"
                description="Sync from eautomate, seed the database, or add a vendor."
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
            <div className="overflow-x-auto px-2 pb-4 md:px-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-24">ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead className="hidden md:table-cell">GSTIN</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((v) => (
                    <TableRow key={v.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-sm">{v.id}</TableCell>
                      <TableCell>
                        <Link
                          href={`/inbound/vendors/${v.id}`}
                          className="text-primary font-medium underline-offset-4 hover:underline"
                        >
                          {v.vendor_name ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {v.vendor_city ?? "—"}
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs md:table-cell">
                        {v.vendor_gstin ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
          <DialogFooter className="flex flex-row gap-2 border-0 bg-transparent p-0 sm:justify-end">
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
