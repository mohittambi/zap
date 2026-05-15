// Visual query builder — module and field definitions.
// This file is server-only (imported by the API route).

export type FieldType = "text" | "date" | "number" | "select";

export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  column: string; // SQL column expression
  options?: { value: string; label: string }[]; // for select type
};

export type QBModule = {
  id: string;
  label: string;
  icon: string;
  domain: "outbound" | "inbound" | "inventory" | "masters";
  table: string;
  tableAlias: string;
  joins?: string; // optional extra JOIN clauses
  fields: FieldDef[];
  defaultColumns: string[]; // field names shown by default
};

export const QB_MODULES: QBModule[] = [
  // ── Outbound ────────────────────────────────────────────────────────────────
  {
    id: "sales_orders",
    label: "Sales Orders",
    icon: "🛒",
    domain: "outbound",
    table: "outbound_purchase_orders",
    tableAlias: "t",
    fields: [
      { name: "company_name", label: "Company", type: "text", column: "t.company_name" },
      { name: "po_number", label: "PO Number", type: "text", column: "t.po_number" },
      { name: "po_issue_date", label: "Issue Date", type: "date", column: "t.po_issue_date" },
      { name: "expiry_date", label: "Expiry Date", type: "date", column: "t.expiry_date" },
      {
        name: "calculated_po_status",
        label: "Status",
        type: "select",
        column: "t.calculated_po_status",
        options: [
          { value: "OPEN", label: "Open" },
          { value: "ACK_PENDING", label: "Ack Pending" },
          { value: "FULFILLED", label: "Fulfilled" },
          { value: "CANCELLED", label: "Cancelled" },
        ],
      },
      { name: "delivery_city", label: "Delivery City", type: "text", column: "t.delivery_city" },
      { name: "sold_via", label: "Channel", type: "text", column: "t.sold_via" },
      { name: "created_by", label: "Created By", type: "text", column: "t.created_by" },
      { name: "created_at", label: "Created At", type: "date", column: "t.created_at" },
    ],
    defaultColumns: ["company_name", "po_number", "po_issue_date", "calculated_po_status", "delivery_city"],
  },
  {
    id: "shipments",
    label: "Shipments",
    icon: "🚚",
    domain: "outbound",
    table: "outbound_consignments",
    tableAlias: "t",
    fields: [
      { name: "company_name", label: "Company", type: "text", column: "t.company_name" },
      { name: "po_number", label: "PO Number", type: "text", column: "t.po_number" },
      {
        name: "consignment_status",
        label: "Status",
        type: "select",
        column: "t.consignment_status",
        options: [
          { value: "DRAFT", label: "Draft" },
          { value: "IN_TRANSIT", label: "In Transit" },
          { value: "DELIVERED", label: "Delivered" },
          { value: "CANCELLED", label: "Cancelled" },
        ],
      },
      { name: "total_quantity", label: "Total Qty", type: "number", column: "t.total_quantity" },
      { name: "sku_count", label: "SKU Count", type: "number", column: "t.sku_count" },
      { name: "transporter_name", label: "Transporter", type: "text", column: "t.transporter_name" },
      { name: "marked_rtd_at", label: "Dispatched At", type: "date", column: "t.marked_rtd_at" },
      { name: "created_at", label: "Created At", type: "date", column: "t.created_at" },
    ],
    defaultColumns: ["company_name", "consignment_status", "total_quantity", "marked_rtd_at"],
  },
  // ── Inbound ─────────────────────────────────────────────────────────────────
  {
    id: "inbound_pos",
    label: "Inbound POs",
    icon: "📥",
    domain: "inbound",
    table: "vendor_purchase_orders",
    tableAlias: "t",
    fields: [
      { name: "vendor_name", label: "Vendor", type: "text", column: "t.vendor_name" },
      { name: "status", label: "Status", type: "text", column: "t.status" },
      { name: "expected_date", label: "Expected Date", type: "date", column: "t.expected_date" },
      { name: "total_quantity", label: "Total Qty", type: "number", column: "t.total_quantity" },
      { name: "total_accepted_quantity", label: "Accepted Qty", type: "number", column: "t.total_accepted_quantity" },
      { name: "total_rejected_quantity", label: "Rejected Qty", type: "number", column: "t.total_rejected_quantity" },
      { name: "created_at", label: "Created At", type: "date", column: "t.created_at" },
      { name: "created_by", label: "Created By", type: "text", column: "t.created_by" },
    ],
    defaultColumns: ["vendor_name", "status", "total_quantity", "total_accepted_quantity", "expected_date"],
  },
  {
    id: "grns",
    label: "GRNs",
    icon: "📋",
    domain: "inbound",
    table: "inbound_grns",
    tableAlias: "t",
    fields: [
      { name: "vendor_name", label: "Vendor", type: "text", column: "t.vendor_name" },
      { name: "grn_status", label: "GRN Status", type: "text", column: "t.grn_status" },
      { name: "grn_audit_status", label: "Audit Status", type: "text", column: "t.grn_audit_status" },
      { name: "grn_invoice_quantity", label: "Invoice Qty", type: "number", column: "t.grn_invoice_quantity" },
      { name: "grn_accepted_quantity", label: "Accepted Qty", type: "number", column: "t.grn_accepted_quantity" },
      { name: "grn_rejected_quantity", label: "Rejected Qty", type: "number", column: "t.grn_rejected_quantity" },
      { name: "grn_shortage_quantity", label: "Shortage Qty", type: "number", column: "t.grn_shortage_quantity" },
      { name: "vendor_invoice_number", label: "Invoice No", type: "text", column: "t.vendor_invoice_number" },
      { name: "created_by", label: "Created By", type: "text", column: "t.created_by" },
      { name: "created_at", label: "Created At", type: "date", column: "t.created_at" },
    ],
    defaultColumns: ["vendor_name", "grn_status", "grn_accepted_quantity", "grn_rejected_quantity", "created_at"],
  },
  // ── Inventory ────────────────────────────────────────────────────────────────
  {
    id: "bin_movements",
    label: "Bin Movements",
    icon: "📊",
    domain: "inventory",
    table: "warehouse_inventory_dump",
    tableAlias: "t",
    fields: [
      { name: "sku_id", label: "SKU", type: "text", column: "t.sku_id" },
      { name: "bin_id", label: "Bin", type: "text", column: "t.bin_id" },
      {
        name: "movement_type",
        label: "Movement Type",
        type: "select",
        column: "t.movement_type",
        options: [
          { value: "SALE", label: "Sale" },
          { value: "GRN_RECEIPT", label: "GRN Receipt" },
          { value: "ADJUSTMENT_IN", label: "Adjustment In" },
          { value: "ADJUSTMENT_OUT", label: "Adjustment Out" },
          { value: "TRANSFER_IN", label: "Transfer In" },
          { value: "TRANSFER_OUT", label: "Transfer Out" },
        ],
      },
      {
        name: "inventory_operation_type",
        label: "Operation",
        type: "select",
        column: "t.inventory_operation_type",
        options: [
          { value: "ADD", label: "Add" },
          { value: "REMOVE", label: "Remove" },
        ],
      },
      { name: "quantity", label: "Qty", type: "number", column: "t.quantity" },
      { name: "user_id", label: "Changed By", type: "text", column: "t.user_id" },
      { name: "created_at", label: "Time", type: "date", column: "t.created_at" },
    ],
    defaultColumns: ["sku_id", "bin_id", "movement_type", "quantity", "created_at"],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: "🏭",
    domain: "inventory",
    table: "listings",
    tableAlias: "t",
    fields: [
      { name: "sku_id", label: "SKU", type: "text", column: "t.sku_id" },
      { name: "description", label: "Description", type: "text", column: "t.description" },
      { name: "available_quantity", label: "Qty on Hand", type: "number", column: "t.available_quantity" },
      { name: "category", label: "Category", type: "text", column: "t.category" },
      { name: "updated_at", label: "Last Updated", type: "date", column: "t.updated_at" },
    ],
    defaultColumns: ["sku_id", "description", "available_quantity", "category"],
  },
  // ── Masters ─────────────────────────────────────────────────────────────────
  {
    id: "vendors",
    label: "Vendors",
    icon: "🏢",
    domain: "masters",
    table: "vendors",
    tableAlias: "t",
    fields: [
      { name: "vendor_name", label: "Vendor Name", type: "text", column: "t.vendor_name" },
      { name: "vendor_city", label: "City", type: "text", column: "t.vendor_city" },
      { name: "vendor_state", label: "State", type: "text", column: "t.vendor_state" },
      { name: "vendor_gstin", label: "GSTIN", type: "text", column: "t.vendor_gstin" },
      { name: "created_at", label: "Created At", type: "date", column: "t.created_at" },
    ],
    defaultColumns: ["vendor_name", "vendor_city", "vendor_state"],
  },
];

export const MODULE_MAP = new Map(QB_MODULES.map((m) => [m.id, m]));

export type Operator =
  | "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
  | "between" | "contains" | "starts" | "is_null" | "not_null";

export const OPERATORS_BY_TYPE: Record<FieldType, { op: Operator; label: string }[]> = {
  text: [
    { op: "contains", label: "contains" },
    { op: "eq", label: "is" },
    { op: "neq", label: "is not" },
    { op: "starts", label: "starts with" },
    { op: "is_null", label: "is empty" },
    { op: "not_null", label: "is not empty" },
  ],
  date: [
    { op: "gte", label: "on or after" },
    { op: "lte", label: "on or before" },
    { op: "between", label: "between" },
    { op: "eq", label: "on" },
    { op: "is_null", label: "is empty" },
    { op: "not_null", label: "is not empty" },
  ],
  number: [
    { op: "eq", label: "=" },
    { op: "gt", label: ">" },
    { op: "gte", label: "≥" },
    { op: "lt", label: "<" },
    { op: "lte", label: "≤" },
    { op: "neq", label: "≠" },
    { op: "between", label: "between" },
  ],
  select: [
    { op: "eq", label: "is" },
    { op: "neq", label: "is not" },
    { op: "is_null", label: "is empty" },
    { op: "not_null", label: "is not empty" },
  ],
};
