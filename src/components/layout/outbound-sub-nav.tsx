"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SESSION_KEY = "outbound_po_sub_tab";

const poSubTabs = [
  { href: "/outbound/new", label: "Add New Purchase Order" },
  { href: "/outbound/wip", label: "WIP Purchase Orders" },
  { href: "/outbound/partial", label: "Partially Created Purchase Orders" },
  { href: "/outbound", label: "All Purchase Orders" },
];

const otherTabs = [
  { href: "/outbound/consignments", label: "Consignments" },
  { href: "/outbound/pending-invoices", label: "Pending Invoices" },
  { href: "/outbound/boxes", label: "Manage Boxes" },
];

const NON_PO_PREFIXES = [
  "/outbound/consignments",
  "/outbound/pending-invoices",
  "/outbound/boxes",
];

function isPoSection(pathname: string): boolean {
  if (NON_PO_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  return pathname === "/outbound" || pathname.startsWith("/outbound/");
}

function resolveSubTab(pathname: string): string {
  for (const { href } of poSubTabs) {
    const match = href === "/outbound" ? pathname === "/outbound" : pathname === href;
    if (match) return href;
  }
  return "";
}

export function OutboundSubNav() {
  const pathname = usePathname();
  const inPoSection = isPoSection(pathname);
  const isDetailPage = pathname.startsWith("/outbound/po/");

  const [activeSubTab, setActiveSubTab] = React.useState<string>(() =>
    resolveSubTab(pathname)
  );

  React.useEffect(() => {
    const resolved = resolveSubTab(pathname);
    if (resolved) {
      setActiveSubTab(resolved);
      try { sessionStorage.setItem(SESSION_KEY, resolved); } catch { /* ignore */ }
    } else if (isDetailPage) {
      try {
        const saved = sessionStorage.getItem(SESSION_KEY);
        setActiveSubTab(saved ?? "/outbound");
      } catch {
        setActiveSubTab("/outbound");
      }
    }
  }, [pathname, isDetailPage]);

  const handleSubTabClick = (href: string) => {
    setActiveSubTab(href);
    try { sessionStorage.setItem(SESSION_KEY, href); } catch { /* ignore */ }
  };

  return (
    <div className="border-b bg-primary text-primary-foreground">
      {/* Top-level nav */}
      <div className="mx-auto flex max-w-[1600px] gap-0 overflow-x-auto px-2 py-0 md:px-4">
        <Link
          href="/outbound"
          className={cn(
            "shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm font-medium transition-colors md:px-4",
            inPoSection
              ? "border-white bg-white text-primary"
              : "text-primary-foreground/90 hover:bg-white/10"
          )}
        >
          Purchase order
        </Link>
        {otherTabs.map(({ href, label }) => {
          const active = pathname.startsWith(href);
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

      {/* PO sub-nav — only visible on PO-section pages */}
      {inPoSection && (
        <div className="border-t border-white/20 bg-primary/80">
          <div className="mx-auto flex max-w-[1600px] gap-0 overflow-x-auto px-2 py-0 md:px-4">
            {poSubTabs.map(({ href, label }) => {
              const active = activeSubTab === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => handleSubTabClick(href)}
                  className={cn(
                    "shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors md:px-4",
                    active
                      ? "border-white text-white"
                      : "border-transparent text-primary-foreground/70 hover:bg-white/10 hover:text-primary-foreground"
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
