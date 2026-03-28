/** Listing + bins from GET /api/listings/sku/:sku_id */

export type ListingBinRow = {
  id: number;
  warehouse_id: number;
  sku_id: string;
  bin_id: string;
  available_quantity: number;
  is_deleted?: number;
};

export type ListingDetail = {
  id: number;
  sku_id: string;
  master_sku?: string | null;
  inventory_sku_id?: string | null;
  pack_combo_sku_id?: string | null;
  sku_type?: string | null;
  inventory_bypass_on?: string | null;
  ops_tag?: string | null;
  category?: string | null;
  description?: string | null;
  meta_fields?: string | null;
  img_hd?: string | null;
  img_white?: string | null;
  img_wdim?: string | null;
  img_link1?: string | null;
  img_link2?: string | null;
  no_of_constituents?: number | null;
  actual_weight?: number;
  dimension?: string | null;
  bulk_price?: number;
  keyword_pool?: string | null;
  material_info?: string | null;
  available_quantity?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  bins: ListingBinRow[];
};

export type SkuAnalytics = {
  inward_30d: number;
  inward_60d: number;
  inward_90d: number;
  outward_30d: number;
  outward_60d: number;
  outward_90d: number;
};

export type WarehouseInventoryLogRow = {
  warehouse_id: number;
  sku_id: string;
  inventory_operation_type: string;
  quantity: number;
  bin_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type PaginatedLogs = {
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: WarehouseInventoryLogRow[];
};

export type OutboundOrderSummary = {
  company: string;
  total_demand: number;
  total_fulfilled: number;
  total_unfulfilled: number;
  revenue_gain: number;
  revenue_loss: number;
  avg_price_incl_tax: number | null;
  loss_pct: number | null;
};

export type OutboundSummaryResponse = {
  overall: OutboundOrderSummary;
  by_company: OutboundOrderSummary[];
};

export type ListingOrderDetailRow = {
  id: number;
  po_number?: string | null;
  po_secondary_sku: string;
  master_sku?: string | null;
  company_name?: string | null;
  company_code_primary?: string | null;
  demand?: number | null;
  dispatched_quantity?: number | null;
  packed_quantity?: number | null;
  calculated_po_status?: string | null;
  po_type?: string | null;
  po_issue_date?: string | null;
  created_at?: string | null;
  mrp?: number;
  rate_without_tax?: number;
  tax_rate?: number;
};

export type PaginatedPurchaseOrders = {
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: ListingOrderDetailRow[];
};

export type VendorBySkuRow = {
  vendor_id: number;
  vendor_name?: string | null;
  sku_id: string;
  cost_price?: number | null;
};
