"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Specialty = {
  id: number;
  vendor_id: number;
  vendor_speciality: string;
};

export type VendorDetail = {
  id: number;
  vendor_name: string;
  created_by?: string | null;
  modified_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  vendor_address_line?: string;
  vendor_city?: string;
  vendor_state?: string;
  vendor_postal_code?: string;
  vendor_gstin?: string;
  vendor_contact_number?: string;
  specialties?: Specialty[];
};

function Field({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-sm break-words">{value || "—"}</p>
    </div>
  );
}

export function VendorDetailsCard({
  data,
  vendorId,
  onSaved,
}: Readonly<{
  data: VendorDetail;
  vendorId: string;
  onSaved: (v: VendorDetail) => void;
}>) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editAddress, setEditAddress] = React.useState("");
  const [editCity, setEditCity] = React.useState("");
  const [editState, setEditState] = React.useState("");
  const [editPostal, setEditPostal] = React.useState("");
  const [editGstin, setEditGstin] = React.useState("");
  const [editPhone, setEditPhone] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!isEditing) {
      setEditName(data.vendor_name ?? "");
      setEditAddress(data.vendor_address_line ?? "");
      setEditCity(data.vendor_city ?? "");
      setEditState(data.vendor_state ?? "");
      setEditPostal(data.vendor_postal_code ?? "");
      setEditGstin(data.vendor_gstin ?? "");
      setEditPhone(data.vendor_contact_number ?? "");
    }
  }, [data, isEditing]);

  function startEdit() {
    setEditName(data.vendor_name ?? "");
    setEditAddress(data.vendor_address_line ?? "");
    setEditCity(data.vendor_city ?? "");
    setEditState(data.vendor_state ?? "");
    setEditPostal(data.vendor_postal_code ?? "");
    setEditGstin(data.vendor_gstin ?? "");
    setEditPhone(data.vendor_contact_number ?? "");
    setIsEditing(true);
  }

  async function saveVendor() {
    if (!editName.trim()) {
      toast.error("Vendor name is required");
      return;
    }
    setSaving(true);
    try {
      const updated = await apiFetch<VendorDetail>(
        `/api/vendors/${encodeURIComponent(vendorId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vendor_name: editName.trim(),
            vendor_address_line: editAddress.trim() || null,
            vendor_city: editCity.trim() || null,
            vendor_state: editState.trim() || null,
            vendor_postal_code: editPostal.trim() || null,
            vendor_gstin: editGstin.trim() || null,
            vendor_contact_number: editPhone.trim() || null,
          }),
        }
      );
      setIsEditing(false);
      toast.success("Vendor updated");
      onSaved(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  const specs = data.specialties ?? [];

  return (
    <>
      <Card className="border-primary/10 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Contact &amp; address</CardTitle>
          {!isEditing ? (
            <Button size="sm" variant="outline" onClick={startEdit}>
              Edit
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label
                    htmlFor="ev-name"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Vendor name
                  </Label>
                  <Input
                    id="ev-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Required"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="ev-gstin"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    GSTIN
                  </Label>
                  <Input
                    id="ev-gstin"
                    value={editGstin}
                    onChange={(e) => setEditGstin(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="ev-phone"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Contact number
                  </Label>
                  <Input
                    id="ev-phone"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label
                    htmlFor="ev-addr"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Address
                  </Label>
                  <Input
                    id="ev-addr"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="ev-city"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    City
                  </Label>
                  <Input
                    id="ev-city"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="ev-state"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    State
                  </Label>
                  <Input
                    id="ev-state"
                    value={editState}
                    onChange={(e) => setEditState(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="ev-postal"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Postal code
                  </Label>
                  <Input
                    id="ev-postal"
                    value={editPostal}
                    onChange={(e) => setEditPostal(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" disabled={saving} onClick={() => void saveVendor()}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="GSTIN" value={data.vendor_gstin ?? ""} />
              <Field label="Contact" value={data.vendor_contact_number ?? ""} />
              <div className="sm:col-span-2">
                <Field label="Address" value={data.vendor_address_line ?? ""} />
              </div>
              <Field label="City" value={data.vendor_city ?? ""} />
              <Field label="State" value={data.vendor_state ?? ""} />
              <Field label="Postal code" value={data.vendor_postal_code ?? ""} />
              <Field label="Created by" value={data.created_by ?? ""} />
              <Field label="Updated" value={data.updated_at ?? ""} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Specialties</CardTitle>
        </CardHeader>
        <CardContent>
          {specs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No specialties recorded.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {specs.map((s) => (
                <Badge key={s.id} variant="secondary">
                  {s.vendor_speciality}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
