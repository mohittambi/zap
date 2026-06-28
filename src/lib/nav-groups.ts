import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Barcode,
  BarChart3,
  BellRing,
  BookOpen,
  Box,
  Boxes,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Database,
  FileClock,
  FileInput,
  FilePlus,
  FileText,
  Grid3x3,
  History,
  Layers,
  ListChecks,
  ListTree,
  Package,
  PackageOpen,
  PackagePlus,
  Receipt,
  ReceiptText,
  ScanLine,
  ScrollText,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Store,
  Tag,
  Tags,
  Target,
  Truck,
  Users,
  Wallet,
  Warehouse,
  Workflow,
  Wrench,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
  sections: NavSection[];
};

export const navGroups: NavGroup[] = [
  {
    id: "products",
    label: "Products",
    icon: Package,
    match: (p) =>
      p.startsWith("/listings") ||
      p.startsWith("/catalogues") ||
      p === "/tags" ||
      p === "/labels",
    sections: [
      {
        title: "Listings",
        items: [
          { href: "/listings/warehouse", label: "Warehouse Listings", icon: Boxes },
          { href: "/listings/secondary", label: "Secondary Listings", icon: Layers },
          { href: "/listings/packs-combos", label: "Packs & Combos", icon: PackagePlus },
          { href: "/listings/bulk", label: "Bulk Operations", icon: ListChecks },
          { href: "/listings/company-sku", label: "Company SKU", icon: Building2 },
          { href: "/listings/focus", label: "Focus List", icon: Target },
        ],
      },
      {
        title: "Catalogues",
        items: [
          { href: "/catalogues", label: "Catalogue List", icon: BookOpen },
          { href: "/tags", label: "Tags", icon: Tags },
        ],
      },
      {
        title: "Labels",
        items: [
          { href: "/labels", label: "Generate Labels", icon: Tag },
          { href: "/listings/labels-master", label: "Labels Master Data", icon: Database },
        ],
      },
    ],
  },
  {
    id: "inbound",
    label: "Inbound",
    icon: Truck,
    match: (p) => p.startsWith("/inbound") || p.startsWith("/vendors"),
    sections: [
      {
        title: "Core",
        items: [
          { href: "/inbound", label: "Vendors", icon: Store },
          { href: "/inbound/purchase-orders", label: "Purchase Orders", icon: FileText },
          { href: "/inbound/sku-wise", label: "SKU Wise View", icon: ListTree },
          { href: "/inbound/grns", label: "All GRNs", icon: ClipboardCheck },
        ],
      },
      {
        title: "Queues",
        items: [
          { href: "/inbound/pending-audits", label: "Pending Audits", icon: ClipboardList },
          {
            href: "/inbound/pending-invoice-collection",
            label: "Pending Invoice Collection",
            icon: ReceiptText,
          },
          { href: "/inbound/pending-accounts", label: "Pending Accounts", icon: Wallet },
          {
            href: "/inbound/pending-debit-credit",
            label: "Pending Debit & Credit",
            icon: ArrowLeftRight,
          },
        ],
      },
      {
        title: "Flows",
        items: [{ href: "/inbound/flows", label: "Inbound Flows", icon: Workflow }],
      },
    ],
  },
  {
    id: "outbound",
    label: "Outbound",
    icon: Send,
    match: (p) => p.startsWith("/outbound"),
    sections: [
      {
        title: "Orders",
        items: [
          { href: "/outbound", label: "All Purchase Orders", icon: FileText },
          { href: "/outbound/wip", label: "WIP Purchase Orders", icon: Clock },
          { href: "/outbound/partial", label: "Partially Created", icon: FileClock },
          { href: "/outbound/new", label: "Add New PO", icon: FilePlus },
        ],
      },
      {
        title: "Fulfillment",
        items: [
          { href: "/outbound/consignments", label: "Consignments", icon: Boxes },
          { href: "/outbound/boxes", label: "Manage Boxes", icon: Box },
          { href: "/outbound/pending-invoices", label: "Pending Invoices", icon: Receipt },
        ],
      },
      {
        title: "Data",
        items: [{ href: "/outbound/ean-mappings", label: "SKU / EAN Mappings", icon: Barcode }],
      },
    ],
  },
  {
    id: "warehouse-ops",
    label: "Warehouse & Ops",
    icon: Warehouse,
    match: (p) =>
      p.startsWith("/warehouses") ||
      p.startsWith("/bins") ||
      p.startsWith("/ops") ||
      p === "/reorder" ||
      p.startsWith("/warehouse-inventory") ||
      p.startsWith("/inventory"),
    sections: [
      {
        title: "Locations",
        items: [
          { href: "/warehouses", label: "Warehouses", icon: Warehouse },
          { href: "/bins", label: "Bins", icon: Grid3x3 },
          { href: "/bins/changes", label: "Bin Changes", icon: History },
          { href: "/bins/scan-update", label: "Scan & Update", icon: ScanLine },
          { href: "/bins/outward", label: "Bin Outward", icon: PackageOpen },
        ],
      },
      {
        title: "Planning",
        items: [
          { href: "/ops/sku-po-control", label: "Ops SKU PO Control", icon: SlidersHorizontal },
          { href: "/reorder", label: "Reorder Alerts", icon: BellRing },
        ],
      },
      {
        title: "Inventory",
        items: [
          { href: "/warehouse-inventory", label: "Warehouse Inventory Log", icon: ScrollText },
          { href: "/inventory/sku-wise", label: "SKU-wise", icon: ListTree },
        ],
      },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    icon: Wrench,
    match: (p) =>
      p.startsWith("/forms") ||
      p === "/flows" ||
      p === "/purchase-orders",
    sections: [
      {
        title: "Data Entry",
        items: [{ href: "/forms", label: "Forms", icon: FileInput }],
      },
      {
        title: "Workflows",
        items: [{ href: "/flows", label: "Flows", icon: Workflow }],
      },
      {
        title: "Reports",
        items: [{ href: "/purchase-orders", label: "Purchase Orders", icon: FileText }],
      },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    icon: Sparkles,
    match: (p) => p.startsWith("/insights"),
    sections: [
      {
        title: "Intelligence",
        items: [
          { href: "/insights", label: "Overview", icon: Sparkles, adminOnly: true },
          { href: "/insights/forecasting", label: "Forecasting", icon: BarChart3, adminOnly: true },
          { href: "/insights/segmentation", label: "Segmentation", icon: Grid3x3, adminOnly: true },
          { href: "/insights/vendors", label: "Vendor Scores", icon: Store, adminOnly: true },
          {
            href: "/insights/working-capital",
            label: "Working Capital",
            icon: Wallet,
            adminOnly: true,
          },
          { href: "/insights/settings", label: "Settings", icon: Settings, adminOnly: true },
        ],
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    match: (p) => p.startsWith("/settings"),
    sections: [
      {
        title: "Admin",
        items: [
          { href: "/settings/users", label: "User Management", icon: Users, adminOnly: true },
          {
            href: "/settings/ean-mappings",
            label: "EAN Mappings",
            icon: Barcode,
            adminOnly: true,
          },
        ],
      },
    ],
  },
];

export function filterNavSections(sections: NavSection[], isAdmin: boolean): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.adminOnly || isAdmin),
    }))
    .filter((section) => section.items.length > 0);
}

export function getActiveNavGroupId(pathname: string | null): string | null {
  if (!pathname) return null;
  return navGroups.find((g) => g.match(pathname))?.id ?? null;
}

const LISTING_SECTION_SLUGS = new Set([
  "warehouse",
  "secondary",
  "packs-combos",
  "bulk",
  "company-sku",
  "labels-master",
  "focus",
]);

export function isNavItemActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;

  if (href === "/bins") {
    return pathname === "/bins";
  }

  if (href === "/inbound/purchase-orders") {
    return (
      pathname.startsWith("/inbound/purchase-orders") ||
      /\/inbound\/vendors\/[^/]+\/purchase-orders\//.test(pathname)
    );
  }

  if (href === "/inbound") {
    return (
      pathname === "/inbound" ||
      (pathname.startsWith("/inbound/vendors/") &&
        !pathname.includes("/purchase-orders/"))
    );
  }

  if (href === "/vendors") {
    return pathname === "/vendors" || pathname.startsWith("/vendors/");
  }

  if (href === "/outbound") {
    return pathname === "/outbound" || pathname.startsWith("/outbound/po/");
  }

  if (href === "/catalogues") {
    return pathname === "/catalogues" || pathname.startsWith("/catalogues/");
  }

  if (href === "/listings/warehouse") {
    if (pathname === "/listings" || pathname.startsWith("/listings/warehouse")) {
      return true;
    }
    const skuDetail = pathname.match(/^\/listings\/([^/]+)$/);
    if (skuDetail && !LISTING_SECTION_SLUGS.has(skuDetail[1])) {
      return true;
    }
    return false;
  }

  if (href === "/purchase-orders") {
    return pathname === "/purchase-orders" || pathname.startsWith("/purchase-orders/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
