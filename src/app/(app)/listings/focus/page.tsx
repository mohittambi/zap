"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import {
  EditFocusListDialog,
  type FocusList,
} from "./edit-focus-list-dialog";

type FocusItem = {
  id: number;
  sku_id: string;
  note?: string | null;
};

export default function FocusListPage() {
  const [privateLists, setPrivateLists] = React.useState<FocusList[] | null>(null);
  const [publicLists, setPublicLists] = React.useState<FocusList[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [title, setTitle] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [isPublic, setIsPublic] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  const [editTarget, setEditTarget] = React.useState<FocusList | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = React.useState<FocusList | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Items dialog
  const [itemsTarget, setItemsTarget] = React.useState<FocusList | null>(null);
  const [items, setItems] = React.useState<FocusItem[]>([]);
  const [itemsLoading, setItemsLoading] = React.useState(false);
  const [removingItemId, setRemovingItemId] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [priv, pub] = await Promise.all([
        apiFetch<FocusList[]>("/api/focus-lists?is_public=false"),
        apiFetch<FocusList[]>("/api/focus-lists?is_public=true"),
      ]);
      setPrivateLists(priv);
      setPublicLists(pub);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setPrivateLists([]);
      setPublicLists([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function createList() {
    if (!title.trim()) { toast.error("Title required"); return; }
    setCreating(true);
    try {
      await apiFetch("/api/focus-lists", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: desc.trim() || undefined,
          is_public: isPublic,
        }),
      });
      toast.success("Focus list created");
      setTitle("");
      setDesc("");
      setIsPublic(false);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/focus-lists/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Focus list deleted");
      setDeleteTarget(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function openItems(list: FocusList) {
    setItemsTarget(list);
    setItemsLoading(true);
    try {
      const data = await apiFetch<FocusItem[]>(`/api/focus-lists/${list.id}/items`);
      setItems(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load items");
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  }

  async function removeItem(itemId: number) {
    if (!itemsTarget) return;
    setRemovingItemId(itemId);
    try {
      await apiFetch(`/api/focus-lists/${itemsTarget.id}/items/${itemId}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      toast.success("Item removed");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setRemovingItemId(null);
    }
  }

  function renderSection(label: string, lists: FocusList[] | null, empty: string) {
    if (loading) return <Skeleton className="h-40 w-full" />;
    if (!lists?.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((f) => (
          <Card key={f.id} className="border-primary/10 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{f.title}</CardTitle>
              <CardDescription className="line-clamp-2">{f.description || "—"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              <p>ID {f.id}</p>
              <p>{f.item_count} items</p>
              <p>{f.created_by ?? "—"}</p>
              <p>{new Date(f.created_at).toLocaleString()}</p>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => void openItems(f)}>
                  View items
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => setEditTarget(f)}
                >
                  Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive h-7 px-2 text-xs" onClick={() => setDeleteTarget(f)}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-primary text-2xl font-semibold">Focus List</h1>
        <p className="text-sm text-muted-foreground">
          Private and public curated SKU lists for merchandising.
        </p>
      </div>

      <Card className="border-primary/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Create focus list</CardTitle>
          <CardDescription>Add a new list; use warehouse preview to add SKUs.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="min-h-11" />
          </div>
          <div className="flex-1 space-y-2">
            <Label>Description</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} className="min-h-11" />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <input
              id="pub"
              type="checkbox"
              className="size-4 accent-primary"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            <Label htmlFor="pub">Public</Label>
          </div>
          <Button className="min-h-11" disabled={creating} onClick={() => void createList()}>
            {creating ? "Creating…" : "Create"}
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Private</h2>
        {renderSection("Private", privateLists, "No private lists yet.")}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Public</h2>
        {renderSection("Public", publicLists, "No public lists yet.")}
      </section>

      <EditFocusListDialog
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => void load()}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete focus list?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.title}</strong> and all its items.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
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

      {/* Items dialog */}
      <Dialog open={!!itemsTarget} onOpenChange={(open) => { if (!open) setItemsTarget(null); }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Items in &ldquo;{itemsTarget?.title}&rdquo;</DialogTitle>
          </DialogHeader>
          {itemsLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No items in this list.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded border px-3 py-2">
                  <div>
                    <p className="font-mono text-sm font-medium">{item.sku_id}</p>
                    {item.note ? <p className="text-muted-foreground text-xs">{item.note}</p> : null}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive h-7 px-2 text-xs"
                    disabled={removingItemId === item.id}
                    onClick={() => void removeItem(item.id)}
                  >
                    {removingItemId === item.id ? "Removing…" : "Remove"}
                  </Button>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setItemsTarget(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
