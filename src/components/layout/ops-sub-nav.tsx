"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  {
    href: "/ops/sku-po-control",
    label: "SKU PO Control",
    match: (p: string) => p.startsWith("/ops/sku-po-control"),
  },
];

export function OpsSubNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="flex flex-wrap gap-2 border-b pb-3">
      {links.map(({ href, label, match }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium",
            match(pathname)
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
