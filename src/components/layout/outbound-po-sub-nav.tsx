"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type PoTabTone = "default" | "wip" | "partial" | "create";

const poTabs: {
  href: string;
  label: string;
  exact: boolean;
  tone: PoTabTone;
}[] = [
  {
    href: "/outbound",
    label: "All Purchase Orders",
    exact: true,
    tone: "default",
  },
  {
    href: "/outbound/wip",
    label: "WIP Purchase Orders",
    exact: true,
    tone: "wip",
  },
  {
    href: "/outbound/partial",
    label: "Partially Created Purchase Orders",
    exact: true,
    tone: "partial",
  },
  {
    href: "/outbound/new",
    label: "Add New Purchase Order",
    exact: true,
    tone: "create",
  },
];

const toneActive: Record<PoTabTone, string> = {
  default:
    "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30",
  wip: "bg-blue-600 text-white shadow-sm ring-1 ring-blue-500/40 dark:bg-blue-600",
  partial:
    "bg-amber-600 text-white shadow-sm ring-1 ring-amber-500/40 dark:bg-amber-600",
  create:
    "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500/40 dark:bg-emerald-600",
};

const toneIdle: Record<PoTabTone, string> = {
  default:
    "text-primary/90 hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/20",
  wip: "text-blue-800/90 hover:bg-blue-500/10 hover:text-blue-900 dark:text-blue-400 dark:hover:bg-blue-500/15",
  partial:
    "text-amber-800/90 hover:bg-amber-500/10 hover:text-amber-900 dark:text-amber-400 dark:hover:bg-amber-500/15",
  create:
    "text-emerald-800/90 hover:bg-emerald-500/10 hover:text-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-500/15",
};

/** True on PO list, create, and PO detail routes (not consignments / invoices / boxes). */
export function isOutboundPurchaseOrdersPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname.startsWith("/outbound/po/")) return true;
  return (
    pathname === "/outbound" ||
    pathname === "/outbound/wip" ||
    pathname === "/outbound/partial" ||
    pathname === "/outbound/new"
  );
}

/** Purchase-order sub-menu under Outbound → Purchase Orders (color-coded by workflow). */
export function OutboundPoSubNav() {
  const pathname = usePathname();
  if (!isOutboundPurchaseOrdersPath(pathname)) return null;

  return (
    <div className="border-b border-primary/15 bg-gradient-to-r from-primary/8 via-background to-primary/5">
      <div className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-2 py-2 md:px-4 md:py-2.5">
        <nav
          className="flex min-w-0 gap-1 overflow-x-auto"
          aria-label="Purchase order views"
        >
          {poTabs.map(({ href, label, exact, tone }) => {
            const active = exact ? pathname === href : pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? toneActive[tone] : toneIdle[tone]
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
