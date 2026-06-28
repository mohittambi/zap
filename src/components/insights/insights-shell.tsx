"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AppPageShell, AppPageTitle } from "@/components/layout/app-page-shell";

const TABS = [
  { href: "/insights", label: "Overview" },
  { href: "/insights/forecasting", label: "Forecasting" },
  { href: "/insights/segmentation", label: "Segmentation" },
  { href: "/insights/vendors", label: "Vendors" },
  { href: "/insights/working-capital", label: "Working Capital" },
  { href: "/insights/settings", label: "Settings" },
] as const;

export function InsightsShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";

  return (
    <AppPageShell>
      <AppPageTitle title={title} description={description} />
      <nav className="mb-4 flex flex-wrap gap-2 border-b pb-3">
        {TABS.map((tab) => {
          const active =
            tab.href === "/insights"
              ? pathname === "/insights"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                active
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </AppPageShell>
  );
}
