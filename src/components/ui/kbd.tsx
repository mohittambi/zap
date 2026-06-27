import * as React from "react";
import { cn } from "@/lib/utils";

export function Kbd({
  className,
  children,
  ...props
}: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex min-h-5 min-w-5 items-center justify-center rounded border border-input bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}

export function KbdGroup({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} {...props}>
      {children}
    </span>
  );
}
