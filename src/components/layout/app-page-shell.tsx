import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Same horizontal padding / max width as listings section (aligns content under header). */
export function AppPageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Page title using eCraft primary accent. */
export function AppPageTitle({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  /** e.g. mb-4 when stacked under a back link */
  className?: string;
}) {
  return (
    <div className={cn("mb-6 space-y-1.5", className)}>
      <h1 className="text-primary text-2xl font-semibold tracking-tight">
        {title}
      </h1>
      {description ? (
        <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
          {description}
        </p>
      ) : null}
    </div>
  );
}
