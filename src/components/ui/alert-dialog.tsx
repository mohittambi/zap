"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Thin wrapper around Dialog that follows the AlertDialog API shape. */
function AlertDialog({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  );
}

function AlertDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      showCloseButton={false}
      className={cn("max-w-md", className)}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

const AlertDialogHeader = DialogHeader;
const AlertDialogTitle = DialogTitle;
const AlertDialogDescription = DialogDescription;

function AlertDialogFooter({ className, children, ...props }: React.ComponentProps<typeof DialogFooter>) {
  return (
    <DialogFooter
      className={cn(
        "gap-3 border-t-0 bg-transparent py-0 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
    </DialogFooter>
  );
}

function AlertDialogCancel({
  className,
  children,
  disabled,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <DialogClose
      render={
        <Button
          variant="outline"
          className={className}
          disabled={disabled}
          type="button"
          {...props}
        />
      }
    >
      {children ?? "Cancel"}
    </DialogClose>
  );
}

function AlertDialogAction({
  className,
  children,
  onClick,
  disabled,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn("bg-destructive text-destructive-foreground hover:bg-destructive/90", className)}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children ?? "Continue"}
    </Button>
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
};
