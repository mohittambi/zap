"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function CardDetailSheet({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-[720px]">
        <SheetHeader className="border-b p-4">
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <p className="text-muted-foreground text-xs">{description}</p>
          ) : null}
        </SheetHeader>
        <div className="overflow-y-auto p-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
