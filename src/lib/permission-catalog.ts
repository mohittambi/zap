/**
 * Permission catalog metadata for Role Management UI and nav visibility.
 * DB rows are source of truth; this file adds module/subgroup grouping.
 */

export type PermissionModuleId =
  | "products"
  | "inbound"
  | "outbound"
  | "warehouse_ops"
  | "tools"
  | "insights"
  | "admin";

export type CatalogPermission = {
  resource: string;
  action: string;
  description: string;
  module: PermissionModuleId;
  subgroup?: string;
};

export const PERMISSION_MODULES: { id: PermissionModuleId; label: string }[] = [
  { id: "products", label: "Products" },
  { id: "inbound", label: "Inbound" },
  { id: "outbound", label: "Outbound" },
  { id: "warehouse_ops", label: "Warehouse & Ops" },
  { id: "tools", label: "Tools" },
  { id: "insights", label: "Insights" },
  { id: "admin", label: "Admin" },
];

/** Permissions assignable in Role Management (excludes admin wildcard). */
export const PERMISSION_CATALOG: CatalogPermission[] = [
  // Products — warehouse listings
  { resource: "listings", action: "read", description: "View warehouse listings", module: "products", subgroup: "warehouse_listings" },
  { resource: "listings", action: "write", description: "Edit SKU listing details", module: "products", subgroup: "warehouse_listings" },
  { resource: "listings", action: "create", description: "Create master SKU listings", module: "products", subgroup: "warehouse_listings" },
  { resource: "listings", action: "delete", description: "Soft-delete master listings", module: "products", subgroup: "warehouse_listings" },
  { resource: "analytics", action: "read", description: "SKU analytics and movement", module: "products", subgroup: "analytics" },
  { resource: "packs_combos", action: "read", description: "Pack and combo definitions", module: "products", subgroup: "analytics" },
  // Secondary
  { resource: "secondary_listings", action: "read", description: "View secondary listings and logs", module: "products", subgroup: "secondary_listings" },
  { resource: "secondary_listings", action: "manage", description: "Manage secondary associations and labels", module: "products", subgroup: "secondary_listings" },
  { resource: "catalogues", action: "read", description: "View catalogues", module: "products", subgroup: "catalogues" },
  { resource: "catalogues", action: "write", description: "Create/update catalogues", module: "products", subgroup: "catalogues" },
  { resource: "focus_lists", action: "read", description: "View focus lists", module: "products", subgroup: "focus_lists" },
  { resource: "focus_lists", action: "write", description: "Edit focus lists", module: "products", subgroup: "focus_lists" },
  { resource: "labels", action: "read", description: "Labels master data", module: "products", subgroup: "labels" },
  { resource: "labels", action: "write", description: "Edit labels master", module: "products", subgroup: "labels" },
  { resource: "company_relations", action: "read", description: "Company–SKU relations", module: "products", subgroup: "company_sku" },
  { resource: "company_relations", action: "write", description: "Edit company–SKU relations", module: "products", subgroup: "company_sku" },
  { resource: "bulk", action: "read", description: "Bulk export", module: "products", subgroup: "bulk" },
  { resource: "bulk", action: "import", description: "Bulk import", module: "products", subgroup: "bulk" },
  // Inbound
  { resource: "vendors", action: "read", description: "View vendors", module: "inbound" },
  { resource: "vendors", action: "create", description: "Create vendors", module: "inbound" },
  { resource: "vendors", action: "write", description: "Update vendors", module: "inbound" },
  { resource: "vendors", action: "delete", description: "Delete vendors", module: "inbound" },
  { resource: "purchase_orders", action: "read", description: "View purchase orders and GRNs", module: "inbound" },
  { resource: "purchase_orders", action: "create", description: "Create purchase orders", module: "inbound" },
  { resource: "purchase_orders", action: "write", description: "Update GRNs and uploads", module: "inbound" },
  { resource: "grn", action: "audit", description: "Mark GRN audit complete", module: "inbound", subgroup: "elevated" },
  { resource: "grn", action: "accounts_approve", description: "Approve/reject GRN accounts", module: "inbound", subgroup: "elevated" },
  { resource: "grn", action: "invoice_collect", description: "Mark GRN invoice collected", module: "inbound", subgroup: "elevated" },
  { resource: "debit_credit", action: "decide", description: "Accept/decline debit/credit notes", module: "inbound", subgroup: "elevated" },
  // Outbound (reuses purchase_orders)
  { resource: "purchase_orders", action: "read", description: "View outbound POs and consignments", module: "outbound" },
  { resource: "purchase_orders", action: "create", description: "Create outbound POs", module: "outbound" },
  { resource: "purchase_orders", action: "write", description: "Update outbound POs and consignments", module: "outbound" },
  // Warehouse & Ops
  { resource: "warehouses", action: "read", description: "View warehouses", module: "warehouse_ops" },
  { resource: "bins", action: "read", description: "View bins", module: "warehouse_ops" },
  { resource: "bins", action: "write", description: "Scan update and bin outward", module: "warehouse_ops" },
  { resource: "bins", action: "manage", description: "Create/delete bin locations", module: "warehouse_ops" },
  { resource: "warehouse_inventory", action: "read", description: "Warehouse inventory log", module: "warehouse_ops" },
  { resource: "inventory", action: "read", description: "SKU-wise inventory views", module: "warehouse_ops" },
  { resource: "inventory", action: "write", description: "Inventory label mutations", module: "warehouse_ops" },
  // Tools
  { resource: "forms", action: "read", description: "View forms", module: "tools" },
  { resource: "forms", action: "write", description: "Submit operational forms", module: "tools" },
  { resource: "query_builder", action: "read", description: "Dashboard query builder", module: "tools" },
  // Insights
  { resource: "insights", action: "read", description: "Decision intelligence hub", module: "insights" },
  { resource: "insights", action: "manage", description: "Configure insights", module: "insights" },
];

const catalogKey = (resource: string, action: string) => `${resource}:${action}`;

const CATALOG_BY_KEY = new Map(
  PERMISSION_CATALOG.map((p) => [catalogKey(p.resource, p.action), p])
);

export function permissionKey(resource: string, action: string): string {
  return `${resource}:${action}`;
}

export function getCatalogEntry(
  resource: string,
  action: string
): CatalogPermission | undefined {
  return CATALOG_BY_KEY.get(catalogKey(resource, action));
}

export function dedupePermissions(
  permissions: { resource: string; action: string }[]
): { resource: string; action: string }[] {
  const seen = new Set<string>();
  const out: { resource: string; action: string }[] = [];
  for (const p of permissions) {
    const key = catalogKey(p.resource, p.action);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ resource: p.resource, action: p.action });
  }
  return out;
}

/** Nav group id → any permission that grants visibility. */
export const MODULE_NAV_PERMISSIONS: Record<
  string,
  { resource: string; action: string }[]
> = {
  products: [
    { resource: "listings", action: "read" },
    { resource: "catalogues", action: "read" },
    { resource: "labels", action: "read" },
    { resource: "focus_lists", action: "read" },
    { resource: "bulk", action: "read" },
    { resource: "analytics", action: "read" },
    { resource: "secondary_listings", action: "read" },
  ],
  inbound: [
    { resource: "vendors", action: "read" },
    { resource: "purchase_orders", action: "read" },
    { resource: "grn", action: "audit" },
    { resource: "grn", action: "invoice_collect" },
    { resource: "debit_credit", action: "decide" },
  ],
  outbound: [{ resource: "purchase_orders", action: "read" }],
  "warehouse-ops": [
    { resource: "bins", action: "read" },
    { resource: "warehouses", action: "read" },
    { resource: "warehouse_inventory", action: "read" },
    { resource: "inventory", action: "read" },
  ],
  tools: [
    { resource: "forms", action: "read" },
    { resource: "query_builder", action: "read" },
  ],
  insights: [{ resource: "insights", action: "read" }],
  settings: [{ resource: "*", action: "*" }],
};

export type PermissionCheck = (resource: string, action: string) => boolean;

export function canAccessNavGroup(
  groupId: string,
  hasPermission: PermissionCheck
): boolean {
  if (hasPermission("*", "*")) return true;
  const gates = MODULE_NAV_PERMISSIONS[groupId];
  if (!gates?.length) return true;
  return gates.some((g) => hasPermission(g.resource, g.action));
}

/** Per-route nav item gates (href → required any). */
export const NAV_ITEM_PERMISSIONS: Record<
  string,
  { resource: string; action: string }[]
> = {
  "/listings/bulk": [
    { resource: "bulk", action: "read" },
    { resource: "bulk", action: "import" },
  ],
  "/listings/secondary": [{ resource: "secondary_listings", action: "read" }],
  "/listings/company-sku": [{ resource: "company_relations", action: "read" }],
  "/listings/focus": [{ resource: "focus_lists", action: "read" }],
  "/catalogues": [{ resource: "catalogues", action: "read" }],
  "/labels": [{ resource: "labels", action: "read" }],
  "/inbound/pending-audits": [{ resource: "grn", action: "audit" }],
  "/inbound/pending-invoice-collection": [{ resource: "grn", action: "invoice_collect" }],
  "/inbound/pending-accounts": [{ resource: "grn", action: "accounts_approve" }],
  "/inbound/pending-debit-credit": [{ resource: "debit_credit", action: "decide" }],
  "/bins/scan-update": [{ resource: "bins", action: "write" }],
  "/bins/outward": [{ resource: "bins", action: "write" }],
  "/bins": [{ resource: "bins", action: "read" }],
};

export function canAccessNavItem(
  href: string,
  hasPermission: PermissionCheck
): boolean {
  if (hasPermission("*", "*")) return true;
  const gates = NAV_ITEM_PERMISSIONS[href];
  if (!gates?.length) return true;
  return gates.some((g) => hasPermission(g.resource, g.action));
}

export const LEGACY_ROLE_NAMES = new Set([
  "ops_manager",
  "warehouse_staff",
  "warehouse_manager",
  "merchandising",
  "sales",
  "viewer",
  "vendor",
]);

export const PROPOSED_ROLE_NAMES = new Set([
  "inventory_management",
  "ops_management",
  "qc",
]);
