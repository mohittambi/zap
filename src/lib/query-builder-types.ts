// Client-safe type definitions and static data for the visual query builder.
// No server-only imports here.

export type FieldType = "text" | "date" | "number" | "select";
export type Operator =
  | "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
  | "between" | "contains" | "starts" | "is_null" | "not_null";

export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
};

export type QBModuleClient = {
  id: string;
  label: string;
  icon: string;
  domain: "outbound" | "inbound" | "inventory" | "masters";
  fields: FieldDef[];
  defaultColumns: string[];
};

export const QB_MODULES_CLIENT: QBModuleClient[] = [
  {
    id: "sales_orders",
    label: "Sales Orders",
    icon: "🛒",
    domain: "outbound",
    fields: [
      { name: "company_name", label: "Company", type: "text" },
      { name: "po_number", label: "PO Number", type: "text" },
      { name: "po_issue_date", label: "Issue Date", type: "date" },
      { name: "expiry_date", label: "Expiry Date", type: "date" },
      {
        name: "calculated_po_status", label: "Status", type: "select",
        options: [
          { value: "OPEN", label: "Open" },
          { value: "ACK_PENDING", label: "Ack Pending" },
          { value: "FULFILLED", label: "Fulfilled" },
          { value: "CANCELLED", label: "Cancelled" },
        ],
      },
      { name: "delivery_city", label: "Delivery City", type: "text" },
      { name: "sold_via", label: "Channel", type: "text" },
      { name: "created_by", label: "Created By", type: "text" },
      { name: "created_at", label: "Created At", type: "date" },
    ],
    defaultColumns: ["company_name", "po_number", "po_issue_date", "calculated_po_status", "delivery_city"],
  },
  {
    id: "shipments",
    label: "Shipments",
    icon: "🚚",
    domain: "outbound",
    fields: [
      { name: "company_name", label: "Company", type: "text" },
      { name: "po_number", label: "PO Number", type: "text" },
      {
        name: "consignment_status", label: "Status", type: "select",
        options: [
          { value: "DRAFT", label: "Draft" },
          { value: "IN_TRANSIT", label: "In Transit" },
          { value: "DELIVERED", label: "Delivered" },
          { value: "CANCELLED", label: "Cancelled" },
        ],
      },
      { name: "total_quantity", label: "Total Qty", type: "number" },
      { name: "sku_count", label: "SKU Count", type: "number" },
      { name: "transporter_name", label: "Transporter", type: "text" },
      { name: "marked_rtd_at", label: "Dispatched At", type: "date" },
      { name: "created_at", label: "Created At", type: "date" },
    ],
    defaultColumns: ["company_name", "consignment_status", "total_quantity", "marked_rtd_at"],
  },
  {
    id: "inbound_pos",
    label: "Inbound POs",
    icon: "📥",
    domain: "inbound",
    fields: [
      { name: "vendor_name", label: "Vendor", type: "text" },
      { name: "status", label: "Status", type: "text" },
      { name: "expected_date", label: "Expected Date", type: "date" },
      { name: "total_quantity", label: "Total Qty", type: "number" },
      { name: "total_accepted_quantity", label: "Accepted Qty", type: "number" },
      { name: "total_rejected_quantity", label: "Rejected Qty", type: "number" },
      { name: "created_at", label: "Created At", type: "date" },
      { name: "created_by", label: "Created By", type: "text" },
    ],
    defaultColumns: ["vendor_name", "status", "total_quantity", "total_accepted_quantity", "expected_date"],
  },
  {
    id: "grns",
    label: "GRNs",
    icon: "📋",
    domain: "inbound",
    fields: [
      { name: "vendor_name", label: "Vendor", type: "text" },
      { name: "grn_status", label: "GRN Status", type: "text" },
      { name: "grn_audit_status", label: "Audit Status", type: "text" },
      { name: "grn_invoice_quantity", label: "Invoice Qty", type: "number" },
      { name: "grn_accepted_quantity", label: "Accepted Qty", type: "number" },
      { name: "grn_rejected_quantity", label: "Rejected Qty", type: "number" },
      { name: "grn_shortage_quantity", label: "Shortage Qty", type: "number" },
      { name: "vendor_invoice_number", label: "Invoice No", type: "text" },
      { name: "created_by", label: "Created By", type: "text" },
      { name: "created_at", label: "Created At", type: "date" },
    ],
    defaultColumns: ["vendor_name", "grn_status", "grn_accepted_quantity", "grn_rejected_quantity", "created_at"],
  },
  {
    id: "bin_movements",
    label: "Bin Movements",
    icon: "📊",
    domain: "inventory",
    fields: [
      { name: "sku_id", label: "SKU", type: "text" },
      { name: "bin_id", label: "Bin", type: "text" },
      {
        name: "movement_type", label: "Movement Type", type: "select",
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
        name: "inventory_operation_type", label: "Operation", type: "select",
        options: [
          { value: "ADD", label: "Add" },
          { value: "REMOVE", label: "Remove" },
        ],
      },
      { name: "quantity", label: "Qty", type: "number" },
      { name: "user_id", label: "Changed By", type: "text" },
      { name: "created_at", label: "Time", type: "date" },
    ],
    defaultColumns: ["sku_id", "bin_id", "movement_type", "quantity", "created_at"],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: "🏭",
    domain: "inventory",
    fields: [
      { name: "sku_id", label: "SKU", type: "text" },
      { name: "description", label: "Description", type: "text" },
      { name: "available_quantity", label: "Qty on Hand", type: "number" },
      { name: "category", label: "Category", type: "text" },
      { name: "updated_at", label: "Last Updated", type: "date" },
    ],
    defaultColumns: ["sku_id", "description", "available_quantity", "category"],
  },
  {
    id: "vendors",
    label: "Vendors",
    icon: "🏢",
    domain: "masters",
    fields: [
      { name: "vendor_name", label: "Vendor Name", type: "text" },
      { name: "vendor_city", label: "City", type: "text" },
      { name: "vendor_state", label: "State", type: "text" },
      { name: "vendor_gstin", label: "GSTIN", type: "text" },
      { name: "created_at", label: "Created At", type: "date" },
    ],
    defaultColumns: ["vendor_name", "vendor_city", "vendor_state"],
  },
];

export const QB_MODULE_MAP = new Map(QB_MODULES_CLIENT.map((m) => [m.id, m]));

export const DOMAIN_LABELS: Record<QBModuleClient["domain"], string> = {
  outbound: "Outbound",
  inbound: "Inbound",
  inventory: "Inventory",
  masters: "Masters",
};

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
