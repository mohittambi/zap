"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  filterNavSections,
  getActiveNavGroupId,
  isNavItemActive,
  navGroups,
  type NavGroup,
} from "@/lib/nav-groups";

type AppSidebarProps = {
  isAdmin?: boolean;
  onNavigate?: () => void;
  className?: string;
};

function SidebarGroup({
  group,
  pathname,
  isAdmin,
  onNavigate,
  open,
  onToggle,
  groupRef,
}: {
  group: NavGroup;
  pathname: string;
  isAdmin: boolean;
  onNavigate?: () => void;
  open: boolean;
  onToggle: () => void;
  groupRef?: React.Ref<HTMLDivElement>;
}) {
  const sections = filterNavSections(group.sections, isAdmin);
  if (sections.length === 0) return null;

  const groupActive = group.match(pathname);
  const GroupIcon = group.icon;

  return (
    <div ref={groupRef} className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-muted/50",
          groupActive ? "text-primary" : "text-foreground"
        )}
        aria-expanded={open}
      >
        <GroupIcon className="size-4 shrink-0" />
        <span className="flex-1">{group.label}</span>
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
      </button>
      {open ? (
        <div className="pb-2">
          {sections.map((section, sectionIndex) => (
            <div
              key={section.title}
              className={cn("px-3", sectionIndex > 0 && "mt-3 border-t border-border/40 pt-3")}
            >
              <p className="mb-1.5 px-2 text-sm font-bold tracking-wide text-primary">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isNavItemActive(pathname, item.href);
                  const ItemIcon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        data-nav-active={active ? "" : undefined}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted hover:text-foreground",
                          active
                            ? "border-l-2 border-primary bg-primary/10 font-medium text-primary"
                            : "text-muted-foreground"
                        )}
                      >
                        <ItemIcon className="size-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AppSidebar({
  isAdmin = false,
  onNavigate,
  className,
}: AppSidebarProps) {
  const pathname = usePathname() ?? "";
  const activeGroupId = getActiveNavGroupId(pathname);
  const prevActiveGroupRef = React.useRef<string | null>(null);
  const groupRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const sidebarRef = React.useRef<HTMLElement>(null);

  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (activeGroupId) initial[activeGroupId] = true;
    return initial;
  });

  React.useEffect(() => {
    if (!activeGroupId) return;
    setOpenGroups((prev) => ({ ...prev, [activeGroupId]: true }));
  }, [activeGroupId]);

  React.useLayoutEffect(() => {
    const prev = prevActiveGroupRef.current;
    prevActiveGroupRef.current = activeGroupId;

    const scrollTarget =
      prev !== activeGroupId && activeGroupId
        ? groupRefs.current[activeGroupId]
        : sidebarRef.current?.querySelector<HTMLElement>("[data-nav-active]");

    scrollTarget?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [pathname, activeGroupId]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <nav
      ref={sidebarRef}
      className={cn("py-2", className)}
      aria-label="Main navigation"
    >
      {navGroups.map((group) => (
        <SidebarGroup
          key={group.id}
          group={group}
          pathname={pathname}
          isAdmin={isAdmin}
          onNavigate={onNavigate}
          open={openGroups[group.id] ?? false}
          onToggle={() => toggleGroup(group.id)}
          groupRef={(el) => {
            groupRefs.current[group.id] = el;
          }}
        />
      ))}
    </nav>
  );
}
