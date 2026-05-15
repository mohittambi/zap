"use client";

import * as React from "react";
import { toast } from "sonner";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildShareUrl } from "@/lib/share-layout";
import type { DashboardLayoutV2 } from "@/lib/dashboard-card-ids";

export function ShareLayoutButton({ layout }: { layout: DashboardLayoutV2 }) {
  const [copying, setCopying] = React.useState(false);
  async function copy() {
    try {
      setCopying(true);
      const url = buildShareUrl(layout);
      await navigator.clipboard.writeText(url);
      toast.success("Layout link copied", {
        description: "Paste it anywhere — opens this exact arrangement.",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't copy");
    } finally {
      setCopying(false);
    }
  }
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={() => void copy()}
      disabled={copying}
    >
      <Share2 className="size-3.5" />
      Share
    </Button>
  );
}
