"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/outbound/new", label: "Add New Purchase Order", exact: true },
  { href: "/outbound/wip", label: "WIP Purchase Orders", exact: true },
  { href: "/outbound/partial", label: "Partially Created Purchase Orders", exact: true },
  { href: "/outbound", label: "All Purchase Orders", exact: true },
  { href: "/outbound/consignments", label: "Consignments", exact: true },
  { href: "/outbound/pending-invoices", label: "Pending Invoices", exact: true },
  { href: "/outbound/boxes", label: "Manage Boxes", exact: true },
];

export function OutboundSubNav() {
  const pathname = usePathname();
  return (
    <div className="border-b bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-[1600px] gap-0 overflow-x-auto px-2 py-0 md:px-4">
        {tabs.map(({ href, label, exact }) => {
          const active = exact ? pathname === href : pathname?.startsWith(href);
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
