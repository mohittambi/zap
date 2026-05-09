"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api-browser";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tag = { id: number; name: string; tag_type: "operational" | "material" };

export function TagPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (next: number[]) => void;
}) {
  const [tags, setTags] = React.useState<Tag[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<Tag[]>("/api/sku-tags");
        if (!cancelled) setTags(res);
      } catch {
        if (!cancelled) setTags([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id: number) {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  }

  if (tags == null) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
          Tags
        </span>
        <span className="text-muted-foreground text-xs">Loading…</span>
      </div>
    );
  }

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
        Tags
      </span>
      <div className="flex flex-wrap gap-1">
        {tags.map((t) => {
          const active = value.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              className={cn(
                "rounded-md transition-opacity",
                active ? "" : "opacity-60 hover:opacity-100"
              )}
            >
              <Badge variant={active ? "default" : "outline"}>{t.name}</Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}
