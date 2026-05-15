"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Purple secondary nav for /catalogues (matches ListingSubNav). */
export function CataloguesSubNav() {
  const pathname = usePathname();
  const isList = pathname === "/catalogues";
  const isTags = pathname === "/tags";
  const isBuilder =
    pathname?.startsWith("/catalogues/") && pathname.includes("/builder");

  const navLinkClass = (active: boolean) =>
    cn(
      "shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm font-medium transition-colors md:px-4",
      active
        ? "border-white bg-white text-primary"
        : "text-primary-foreground/90 hover:bg-white/10"
    );

  return (
    <div className="border-b bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-[1600px] gap-0 overflow-x-auto px-2 py-0 md:px-4">
        <Link href="/catalogues" className={navLinkClass(isList)}>
          Catalogue list
        </Link>
        <Link href="/tags" className={navLinkClass(isTags)}>
          Tags
        </Link>
        {isBuilder && (
          <span
            className="shrink-0 border-b-2 border-white bg-white px-3 py-3 text-sm font-medium text-primary md:px-4"
            aria-current="page"
          >
            Builder
          </span>
        )}
      </div>
    </div>
  );
}
