"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Copy,
  Download,
  EyeOff,
  Filter,
  MoreVertical,
  Maximize2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type CardAction =
  | "refresh"
  | "expand"
  | "export"
  | "copy_link"
  | "filter"
  | "hide";

export type CardActionsMenuProps = {
  available: CardAction[];
  onAction: (action: CardAction) => void;
};

const LABELS: Record<CardAction, string> = {
  refresh: "Refresh",
  expand: "Expand",
  export: "Export CSV",
  copy_link: "Copy link",
  filter: "Filter this card…",
  hide: "Hide card",
};

const ICONS: Record<CardAction, typeof MoreVertical> = {
  refresh: RefreshCw,
  expand: Maximize2,
  export: Download,
  copy_link: Copy,
  filter: Filter,
  hide: EyeOff,
};

export function CardActionsMenu({ available, onAction }: CardActionsMenuProps) {
  const handle = React.useCallback(
    (action: CardAction) => {
      try {
        onAction(action);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      }
    },
    [onAction]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Card actions"
            className="size-6"
            data-no-drag
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="size-3" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
        {available.map((action, i) => {
          const Icon = ICONS[action];
          const last = i === available.length - 1;
          // Hide is destructive — render with separator.
          if (action === "hide") {
            return (
              <React.Fragment key={action}>
                {i > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem
                  onClick={() => handle(action)}
                  className="text-destructive"
                >
                  <Icon className="size-3.5" />
                  {LABELS[action]}
                </DropdownMenuItem>
              </React.Fragment>
            );
          }
          return (
            <DropdownMenuItem key={action} onClick={() => handle(action)}>
              <Icon className="size-3.5" />
              {LABELS[action]}
              {last && available[i + 1] === undefined ? null : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
