"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Keyboard, Menu, PanelLeft, PanelLeftClose, Users } from "lucide-react";
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
import { useAuth } from "@/contexts/auth-context";
import { ShellUiProvider, useShellUi } from "@/contexts/shell-ui-context";
import { ThemeToggle } from "./theme-toggle";
import { AppFooter } from "./app-footer";
import { AppSidebar } from "./app-sidebar";
import { CommandPalette } from "./command-palette";
import { KeyboardShortcutsGuide } from "./keyboard-shortcuts-guide";
import { GlobalKeyboardShortcuts } from "./global-keyboard-shortcuts";
import { cn } from "@/lib/utils";
import { useActivityTracker } from "@/hooks/use-activity-tracker";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, logout, isAdmin, isSuperAdmin } = useAuth();
  const {
    sidebarOpen,
    toggleSidebar,
    setShortcutsGuideOpen,
    mobileNavOpen,
    setMobileNavOpen,
  } = useShellUi();

  useActivityTracker(Boolean(user));

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <GlobalKeyboardShortcuts />
      <CommandPalette />
      <KeyboardShortcutsGuide />

      <header className="sticky top-0 z-50 shrink-0 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center gap-2 px-3 py-2 md:px-4">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="size-5" />
                </Button>
              }
            />
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetHeader className="border-b p-4 text-left">
                <SheetTitle>eCraft Zap</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100dvh-4.5rem)]">
                <AppSidebar
                  isAdmin={isAdmin}
                  isSuperAdmin={isSuperAdmin}
                  onNavigate={() => setMobileNavOpen(false)}
                />
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="size-5" />
            ) : (
              <PanelLeft className="size-5" />
            )}
          </Button>

          <Link
            href="/"
            className="shrink-0 text-lg font-semibold tracking-tight text-primary"
          >
            eCraft Zap
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
              aria-label="Keyboard shortcuts"
              onClick={() => setShortcutsGuideOpen(true)}
            >
              <Keyboard className="size-5" />
            </Button>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className="relative h-11 gap-2 rounded-full px-2 md:h-9"
                  >
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
                  {isAdmin ? (
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => router.push("/settings/users")}
                    >
                      <Users className="size-4" />
                      User Management
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onClick={() => logout()}>Sign out</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={cn(
            "hidden shrink-0 flex-col border-border bg-card transition-[width,border-color] duration-200 ease-in-out md:flex",
            sidebarOpen ? "w-60 border-r" : "w-0 overflow-hidden border-r-0"
          )}
          aria-hidden={!sidebarOpen}
        >
          <ScrollArea className="h-full min-h-0 w-60 flex-1">
            <AppSidebar isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} />
          </ScrollArea>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {children}
          <AppFooter />
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ShellUiProvider>
      <AppShellInner>{children}</AppShellInner>
    </ShellUiProvider>
  );
}
