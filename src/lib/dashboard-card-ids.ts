// Card IDs the home dashboard knows about. Kept in a server-free module so
// client components and hooks can import the enum without dragging `pg` and
// other Node-only deps into the browser bundle.

export const DASHBOARD_CARD_IDS = [
  "sales_qty",
  "sales_pos",
  "fill_rate_pct",
  "inbound_qty",
  "skus_below_reorder",
  "ops_queues",
  "open_pos",
  "vendor_quality",
  "inventory_snapshot",
  "trends",
  "channel_mix",
  "reorder_alerts_strip",
  "saved_query_panel",
] as const;

export type DashboardCardId = (typeof DASHBOARD_CARD_IDS)[number];

export type DashboardLayout = {
  visible_cards: DashboardCardId[];
  default_company_id?: number | null;
};
