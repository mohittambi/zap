"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/listings/warehouse", label: "Warehouse Listings" },
  { href: "/listings/secondary", label: "Secondary Listings" },
  { href: "/listings/packs-combos", label: "Packs & Combos" },
  { href: "/listings/bulk", label: "Bulk Operations" },
  { href: "/listings/company-sku", label: "Secondary Company SKU Relation" },
  { href: "/listings/labels-master", label: "Labels Master Data" },
  { href: "/listings/focus", label: "Focus List" },
];

export function ListingSubNav() {
  const pathname = usePathname();
  return (
    <div className="border-b border-border/60 bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40">
      <nav
        aria-label="Listings sections"
        className="mx-auto flex max-w-[1600px] items-center gap-1 overflow-x-auto px-2 py-1.5 md:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map(({ href, label }) => {
          const active =
            pathname === href ||
            (href === "/listings/warehouse" &&
              (pathname === "/listings" || pathname === "/listings/warehouse"));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors duration-200 md:px-4",
                "focus-visible:ring-2 focus-visible:ring-ring/60",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              {label}
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-x-3 -bottom-[7px] h-0.5 rounded-full transition-all duration-200 md:inset-x-4",
                  active
                    ? "bg-primary opacity-100"
                    : "bg-transparent opacity-0"
                )}
              />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
