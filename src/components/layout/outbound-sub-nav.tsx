"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { OutboundPoSubNav, isOutboundPurchaseOrdersPath } from "./outbound-po-sub-nav";

type ModuleTone = "po" | "ean" | "consignments" | "invoices" | "boxes";

const moduleTabs: {
  href: string;
  label: string;
  match: (p: string | null) => boolean;
  tone: ModuleTone;
}[] = [
  {
    href: "/outbound",
    label: "Purchase Orders",
    match: isOutboundPurchaseOrdersPath,
    tone: "po",
  },
  {
    href: "/outbound/ean-mappings",
    label: "SKU / EAN Mappings",
    match: (p) => !!p && p.startsWith("/outbound/ean-mappings"),
    tone: "ean",
  },
  {
    href: "/outbound/consignments",
    label: "Consignments",
    match: (p) => !!p && p.startsWith("/outbound/consignments"),
    tone: "consignments",
  },
  {
    href: "/outbound/pending-invoices",
    label: "Pending Invoices",
    match: (p) => !!p && p.startsWith("/outbound/pending-invoices"),
    tone: "invoices",
  },
  {
    href: "/outbound/boxes",
    label: "Manage Boxes",
    match: (p) => !!p && p.startsWith("/outbound/boxes"),
    tone: "boxes",
  },
];

const moduleActive: Record<ModuleTone, string> = {
  po: "border-white bg-white text-primary shadow-sm",
  ean: "border-white bg-white text-primary shadow-sm",
  consignments: "border-white bg-white text-primary shadow-sm",
  invoices: "border-white bg-white text-primary shadow-sm",
  boxes: "border-white bg-white text-primary shadow-sm",
};

/** Outbound module nav (row 1). PO drill-down uses {@link OutboundPoSubNav}. */
export function OutboundSubNav() {
  const pathname = usePathname();
  return (
    <>
      <div className="border-b bg-primary text-primary-foreground shadow-sm">
        <div className="mx-auto flex max-w-[1600px] gap-0 overflow-x-auto px-2 py-0 md:px-4">
          <nav
            className="flex min-w-0 gap-0 overflow-x-auto"
            aria-label="Outbound modules"
          >
            {moduleTabs.map(({ href, label, match, tone }) => {
              const active = match(pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm font-medium transition-colors md:px-4",
                    active
                      ? moduleActive[tone]
                      : "text-primary-foreground/90 hover:bg-white/10"
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      <OutboundPoSubNav />
    </>
  );
}
