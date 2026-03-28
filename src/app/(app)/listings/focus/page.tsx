"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type FocusList = {
  id: number;
  title: string;
  description?: string | null;
  is_public: boolean;
  created_by?: string | null;
  created_at: string;
  item_count: number;
};

export default function FocusListPage() {
  const [privateLists, setPrivateLists] = React.useState<FocusList[] | null>(null);
  const [publicLists, setPublicLists] = React.useState<FocusList[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [title, setTitle] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [isPublic, setIsPublic] = React.useState(false);

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
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
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
    }
  }

  function renderSection(
    label: string,
    lists: FocusList[] | null,
    empty: string
  ) {
    if (loading) {
      return <Skeleton className="h-40 w-full" />;
    }
    if (!lists?.length) {
      return <p className="text-sm text-muted-foreground">{empty}</p>;
    }
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((f) => (
          <Card key={f.id} className="border-primary/10 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{f.title}</CardTitle>
              <CardDescription className="line-clamp-2">
                {f.description || "—"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              <p>ID {f.id}</p>
              <p>{f.item_count} items</p>
              <p>{f.created_by ?? "—"}</p>
              <p>{new Date(f.created_at).toLocaleString()}</p>
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
          <Button className="min-h-11" onClick={() => void createList()}>
            Create
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
    </div>
  );
}
