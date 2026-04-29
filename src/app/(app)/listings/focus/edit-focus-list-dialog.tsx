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

export type FocusList = {
  id: number;
  title: string;
  description?: string | null;
  is_public: boolean;
  created_by?: string | null;
  created_at: string;
  item_count: number;
};

export function EditFocusListDialog({
  target,
  onClose,
  onSaved,
}: Readonly<{
  target: FocusList | null;
  onClose: () => void;
  onSaved: () => void;
}>) {
  const [title, setTitle] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [isPub, setIsPub] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (target) {
      setTitle(target.title);
      setDesc(target.description ?? "");
      setIsPub(target.is_public);
    }
  }, [target]);

  async function save() {
    if (!target) return;
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/api/focus-lists/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          description: desc.trim() || null,
          is_public: isPub,
        }),
      });
      toast.success("Focus list updated");
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
          <DialogTitle>Edit focus list</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ef-title">Title</Label>
            <Input
              id="ef-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Required"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ef-desc">Description (optional)</Label>
            <Input id="ef-desc" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="ef-pub"
              type="checkbox"
              className="size-4 accent-primary"
              checked={isPub}
              onChange={(e) => setIsPub(e.target.checked)}
            />
            <Label htmlFor="ef-pub">Public</Label>
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
