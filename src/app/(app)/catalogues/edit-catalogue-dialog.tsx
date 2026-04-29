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

export type CatRow = {
  id: number;
  catalogue_type: string;
  name: string;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
  sku_count: number;
  catalogue_name?: string;
  catalogue_description?: string | null;
  catalogue_type_legacy?: string;
};

export function EditCatalogueDialog({
  target,
  onClose,
  onSaved,
}: Readonly<{
  target: CatRow | null;
  onClose: () => void;
  onSaved: () => void;
}>) {
  const [name, setName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (target) {
      setName(target.name ?? "");
      setDesc(target.description ?? "");
    }
  }, [target]);

  async function save() {
    if (!target) return;
    if (!name.trim()) {
      toast.error("Name required");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/api/catalogues/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          description: desc.trim() || null,
        }),
      });
      toast.success("Catalogue updated");
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit catalogue</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ec-name">Name</Label>
            <Input
              id="ec-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Catalogue name"
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ec-desc">Description (optional)</Label>
            <Input
              id="ec-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Description"
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
