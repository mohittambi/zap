export type OpsSkuPoCompanyOutbound = {
  open_actual_po_qty: number;
  open_po_qty_sent: number;
  total_pending: number;
  open_po_fill_rate_pct: number | null;
};

export type OpsCompanyOutboundColumn = {
  company_id: number;
  name: string;
  column_key: string;
};

export type OpsSkuPoControlRow = {
  master_sku: string;
  open_actual_po_qty: number;
  open_po_qty_sent: number;
  total_pending: number;
  open_po_fill_rate_pct: number | null;
  order_placed_by_ops: number;
  app_stock: number;
  order_place_pending: number;
  /** Per sales-channel outbound rollup; keys match `OpsCompanyOutboundColumn.column_key`. */
  outbound_by_company: Record<string, OpsSkuPoCompanyOutbound>;
};

export type OpsSkuPoControlSummary = {
  summary_open_actual_po_qty: number;
  summary_open_po_qty_sent: number;
  summary_total_pending: number;
  summary_order_place_pending: number;
};

export type OpsSkuPoControlListResult = {
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: OpsSkuPoControlRow[];
  companies: OpsCompanyOutboundColumn[];
  summary: OpsSkuPoControlSummary;
  meta: {
    computed_from_cache: boolean;
    cache_computed_at: string | null;
    open_outbound_po_count: number;
    open_inbound_po_count: number;
    pos_without_snapshot: number;
    unmapped_inbound_line_count: number;
  };
};

export function companyOutboundColumnKey(companyId: number): string {
  return `outbound_pending_${companyId}`;
}
