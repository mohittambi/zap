"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  {
    href: "/ops/sku-po-control",
    label: "SKU PO Control",
    match: (p: string) => p.startsWith("/ops/sku-po-control"),
  },
];

export function OpsSubNav() {
  const pathname = usePathname() ?? "";
  return (
    <div className="border-b bg-primary text-primary-foreground shadow-sm">
      <div className="mx-auto flex max-w-[1600px] gap-0 overflow-x-auto px-2 py-0 md:px-4">
        <nav
          className="flex min-w-0 gap-0 overflow-x-auto"
          aria-label="Ops planning"
        >
          {tabs.map(({ href, label, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
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
        </nav>
      </div>
    </div>
  );
}
