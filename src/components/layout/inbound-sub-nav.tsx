"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs: { href: string; label: string; match: (p: string | null) => boolean }[] = [
  {
    href: "/inbound",
    label: "Vendors",
    match: (p) =>
      p === "/inbound" ||
      (!!p &&
        p.startsWith("/inbound/vendors/") &&
        !p.includes("/purchase-orders/")),
  },
  {
    href: "/inbound/purchase-orders",
    label: "Purchase Orders",
    match: (p) =>
      !!p &&
      (p.startsWith("/inbound/purchase-orders") ||
        /\/inbound\/vendors\/[^/]+\/purchase-orders\//.test(p)),
  },
  {
    href: "/inbound/sku-wise",
    label: "SKU Wise View",
    match: (p) => !!p && p.startsWith("/inbound/sku-wise"),
  },
  {
    href: "/inbound/grns",
    label: "All GRNs",
    match: (p) => !!p && p.startsWith("/inbound/grns"),
  },
  {
    href: "/inbound/pending-audits",
    label: "Pending Audits",
    match: (p) => !!p && p.startsWith("/inbound/pending-audits"),
  },
  {
    href: "/inbound/pending-invoice-collection",
    label: "Pending Invoice Collection",
    match: (p) => !!p && p.startsWith("/inbound/pending-invoice-collection"),
  },
  {
    href: "/inbound/pending-accounts",
    label: "Pending Accounts",
    match: (p) => !!p && p.startsWith("/inbound/pending-accounts"),
  },
  {
    href: "/inbound/pending-debit-credit",
    label: "Pending Debit & Credit Notes",
    match: (p) => !!p && p.startsWith("/inbound/pending-debit-credit"),
  },
];

/** Second-level nav for Inbound only (Vendors, POs, …). */
export function InboundSubNav() {
  const pathname = usePathname();
  return (
    <div className="border-b bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-[1600px] gap-0 overflow-x-auto px-2 py-0 md:px-4">
        {tabs.map(({ href, label, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm font-medium transition-colors md:px-4",
                active
                  ? "border-white bg-white text-primary"
                  : "text-primary-foreground/90 hover:bg-white/10"
              )}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
