"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { ThemeToggle } from "./theme-toggle";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";

const primaryNav = [
  {
    href: "/listings/warehouse",
    label: "Listings & Inventory",
    match: (p: string | null) => !!p?.startsWith("/listings"),
  },
  {
    href: "/catalogues",
    label: "Catalogues",
    match: (p: string | null) => !!p?.startsWith("/catalogues"),
  },
  {
    href: "/inbound",
    label: "Inbound",
    match: (p: string | null) => !!p?.startsWith("/inbound"),
  },
  {
    href: "/outbound",
    label: "Outbound",
    match: (p: string | null) => !!p?.startsWith("/outbound"),
  },
  {
    href: "/labels",
    label: "Labels",
    match: (p: string | null) => p === "/labels",
  },
];

const moreLinks = [
  { href: "/vendors", label: "Vendors" },
  { href: "/warehouses", label: "Warehouses" },
  { href: "/bins", label: "Bins" },
  { href: "/reorder", label: "Reorder alerts" },
  { href: "/forms", label: "Forms" },
  { href: "/purchase-orders", label: "Purchase orders" },
  { href: "/warehouse-inventory", label: "Warehouse inventory log" },
  { href: "/inventory/packs", label: "Inventory — Packs (legacy)" },
  { href: "/inventory/secondary", label: "Inventory — Secondary (legacy)" },
];

function NavLinksShell({
  pathname,
  onNavigate,
  isAdmin,
}: {
  pathname: string | null;
  onNavigate?: () => void;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  return (
    <nav className="flex flex-col gap-1 md:flex-row md:items-center md:gap-1">
      {primaryNav.map(({ href, label, match }) => {
        const active = match(pathname ?? null);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "rounded-full px-3 py-2 text-sm font-medium md:py-1.5",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {label}
          </Link>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
              More <ChevronDown className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Operations</DropdownMenuLabel>
            {moreLinks.map(({ href, label }) => (
              <DropdownMenuItem
                key={href}
                onClick={() => {
                  router.push(href);
                  onNavigate?.();
                }}
              >
                {label}
              </DropdownMenuItem>
            ))}
            {isAdmin ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Admin</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => {
                    router.push("/settings/users");
                    onNavigate?.();
                  }}
                >
                  User management
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "?";

  async function refreshApiKey() {
    try {
      const res = await apiFetch<{ api_key: string; message: string }>(
        "/api/auth/refresh-api-key",
        { method: "POST" }
      );
      toast.success("New API key generated", {
        description: "Copy it now — it won’t be shown again.",
      });
      await navigator.clipboard.writeText(res.api_key);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-3 py-2 md:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              }
            />
            <SheetContent side="left" className="w-80 p-0">
              <SheetHeader className="border-b p-4 text-left">
                <SheetTitle>eCraft Zap</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100dvh-5rem)] px-4 py-4">
                <NavLinksShell
                  pathname={pathname}
                  onNavigate={() => setOpen(false)}
                  isAdmin={isAdmin}
                />
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <Link
            href="/listings/warehouse"
            className="shrink-0 text-lg font-semibold tracking-tight text-primary"
          >
            eCraft Zap
          </Link>

          <nav className="ml-2 hidden flex-1 flex-wrap items-center gap-1 md:ml-6 md:flex">
            <NavLinksShell pathname={pathname} />
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" className="relative h-11 gap-2 rounded-full px-2 md:h-9">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-[120px] truncate text-sm text-muted-foreground lg:inline">
                      {user?.email}
                    </span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">{user?.email}</span>
                      <span className="text-xs text-muted-foreground">
                        {user?.roles?.join(", ") || "—"}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => void refreshApiKey()}>
                      Regenerate API key
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => router.push("/settings/users")}>
                      User management
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => logout()}>Sign out</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</main>
    </div>
  );
}
