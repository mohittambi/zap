"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/listings/warehouse", label: "Warehouse Listings" },
  { href: "/listings/secondary", label: "Secondary Listings" },
  { href: "/listings/packs-combos", label: "Packs And Combos" },
  { href: "/listings/bulk", label: "Bulk Operations" },
  { href: "/listings/company-sku", label: "Secondary Company SKU Relation" },
  { href: "/listings/labels-master", label: "Labels Master Data" },
  { href: "/listings/focus", label: "Focus List" },
];

export function ListingSubNav() {
  const pathname = usePathname();
  return (
    <div className="border-b bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-[1600px] gap-0 overflow-x-auto px-2 py-0 md:px-4">
        {tabs.map(({ href, label }) => {
          const active =
            pathname === href ||
            (href === "/listings/warehouse" &&
              (pathname === "/listings" || pathname === "/listings/warehouse"));
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
