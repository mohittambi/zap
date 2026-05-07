"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type VendorRow = {
  id: string | number;
  vendor_name?: string | null;
  name?: string | null;
  email?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  pin_code?: string | null;
  gstin?: string | null;
  gst_number?: string | null;
  notes?: string | null;
  remarks?: string | null;
};

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

export function EditVendorDialog({
  target,
  onClose,
  onSaved,
}: Readonly<{
  target: VendorRow | null;
  onClose: () => void;
  onSaved: () => void;
}>) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState("");
  const [pincode, setPincode] = React.useState("");
  const [gstin, setGstin] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (target) {
      setName(str(target.vendor_name ?? target.name));
      setEmail(str(target.email ?? target.contact_email));
      setPhone(str(target.phone ?? target.mobile ?? target.contact_phone));
      setAddress(str(target.address ?? target.address_line1));
      setCity(str(target.city));
      setState(str(target.state));
      setPincode(str(target.pincode ?? target.pin_code));
      setGstin(str(target.gstin ?? target.gst_number));
      setNotes(str(target.notes ?? target.remarks));
    }
  }, [target]);

  async function save() {
    if (!target) return;
    if (!name.trim()) {
      toast.error("Vendor name required");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/api/vendors/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          vendor_name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          pincode: pincode.trim() || null,
          gstin: gstin.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      toast.success("Vendor updated");
      onClose();
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={!!target}
      onOpenChange={(open: boolean) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit vendor</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ev-name">Vendor name</Label>
            <Input
              id="ev-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vendor name"
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ev-email">Email</Label>
            <Input
              id="ev-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@example.com"
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ev-phone">Phone</Label>
            <Input
              id="ev-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="min-h-11"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ev-address">Address</Label>
            <Input
              id="ev-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address"
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ev-city">City</Label>
            <Input
              id="ev-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ev-state">State</Label>
            <Input
              id="ev-state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="State"
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ev-pincode">Pincode</Label>
            <Input
              id="ev-pincode"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              placeholder="400001"
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ev-gstin">GSTIN</Label>
            <Input
              id="ev-gstin"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              placeholder="22AAAAA0000A1Z5"
              className="min-h-11"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ev-notes">Notes</Label>
            <Input
              id="ev-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes"
              className="min-h-11"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={submitting} onClick={() => void save()}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
