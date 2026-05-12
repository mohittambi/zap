// Card IDs the home dashboard knows about. Kept in a server-free module so
// client components and hooks can import the enum without dragging `pg` and
// other Node-only deps into the browser bundle.

export const DASHBOARD_CARD_IDS = [
  "sales_qty",
  "sales_pos",
  "fill_rate_pct",
  "inbound_qty",
  "skus_below_reorder",
  "gmv_value_30d",
  "ops_queues",
  "open_pos",
  "vendor_quality",
  "inventory_snapshot",
  "sku_velocity_buckets",
  "trends",
  "channel_mix",
  "reorder_alerts_strip",
  "sku_movement",
  "stockout_risk",
  "dead_stock",
  "saved_query_panel",
  "custom_query",
] as const;

export type DashboardCardId = (typeof DASHBOARD_CARD_IDS)[number];

// ── v1 (legacy) ──────────────────────────────────────────────────────────────
// Kept for one release for backward compat on the wire. Reading this from the
// DB triggers a v1 → v2 migration; the client only ever sees v2 going forward.

export type DashboardLayout = {
  visible_cards: DashboardCardId[];
  default_company_id?: number | null;
};

// ── v2 (current) ─────────────────────────────────────────────────────────────

export const CHART_TYPES = ["line", "bar", "area", "sparkline"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export type CardPosition = { x: number; y: number; w: number; h: number };

export type CardFilters = {
  company_id?: number | null;
  date_from?: string;
  date_to?: string;
};

export type CardConfig = {
  id: DashboardCardId;
  hidden?: boolean;
  pos?: CardPosition;
  chart_type?: ChartType;
  filters?: CardFilters;
};

export type DashboardLayoutV2 = {
  version: 2;
  cards: CardConfig[];
  default_company_id?: number | null;
};

// 12-column grid; row height is ~80px in DashboardGrid. Defaults match the
// pre-Phase-4 static layout so first-time users see no visual change.
const DEFAULT_POSITIONS: Record<DashboardCardId, CardPosition> = {
  // KPI row 1 — 5 cards across 12 cols (3-2-2-2-3 split)
  sales_qty: { x: 0, y: 0, w: 3, h: 2 },
  sales_pos: { x: 3, y: 0, w: 2, h: 2 },
  fill_rate_pct: { x: 5, y: 0, w: 2, h: 2 },
  inbound_qty: { x: 7, y: 0, w: 2, h: 2 },
  skus_below_reorder: { x: 9, y: 0, w: 3, h: 2 },
  // KPI row 2 — value + velocity overview
  gmv_value_30d: { x: 0, y: 2, w: 4, h: 2 },
  sku_velocity_buckets: { x: 4, y: 2, w: 8, h: 2 },
  // Ops row — 4 cards across 12 cols
  ops_queues: { x: 0, y: 4, w: 3, h: 3 },
  open_pos: { x: 3, y: 4, w: 3, h: 3 },
  vendor_quality: { x: 6, y: 4, w: 3, h: 3 },
  inventory_snapshot: { x: 9, y: 4, w: 3, h: 3 },
  // Trends — full-width
  trends: { x: 0, y: 7, w: 12, h: 4 },
  // Channel mix — full-width
  channel_mix: { x: 0, y: 11, w: 12, h: 4 },
  // Reorder strip — full-width
  reorder_alerts_strip: { x: 0, y: 15, w: 12, h: 5 },
  // SKU movement table — full-width
  sku_movement: { x: 0, y: 20, w: 12, h: 6 },
  // Stockout-risk + dead-stock — side-by-side
  stockout_risk: { x: 0, y: 26, w: 6, h: 5 },
  dead_stock: { x: 6, y: 26, w: 6, h: 5 },
  // Saved-query panel — full-width
  saved_query_panel: { x: 0, y: 31, w: 12, h: 6 },
  // Custom SQL query builder — full-width
  custom_query: { x: 0, y: 37, w: 12, h: 8 },
};

export function defaultPositionFor(id: DashboardCardId): CardPosition {
  return { ...DEFAULT_POSITIONS[id] };
}

export const DEFAULT_LAYOUT_V2: DashboardLayoutV2 = {
  version: 2,
  cards: DASHBOARD_CARD_IDS.map((id) => ({
    id,
    pos: defaultPositionFor(id),
  })),
  default_company_id: null,
};

// ── Migration: v1 (legacy) → v2 ──────────────────────────────────────────────

function looksLikeV2(raw: unknown): raw is DashboardLayoutV2 {
  return (
    typeof raw === "object" &&
    raw !== null &&
    (raw as { version?: unknown }).version === 2 &&
    Array.isArray((raw as { cards?: unknown }).cards)
  );
}

function looksLikeV1(raw: unknown): raw is DashboardLayout {
  return (
    typeof raw === "object" &&
    raw !== null &&
    Array.isArray((raw as { visible_cards?: unknown }).visible_cards)
  );
}

/**
 * Coerce any persisted shape to v2. Unknown card IDs are dropped; missing
 * positions/chart-types fall back to defaults at render time.
 */
export function migrateLayout(raw: unknown): DashboardLayoutV2 {
  const allowed = new Set<string>(DASHBOARD_CARD_IDS);

  if (looksLikeV2(raw)) {
    const cards: CardConfig[] = [];
    for (const id of DASHBOARD_CARD_IDS) {
      const found = raw.cards.find(
        (c) => typeof c === "object" && c !== null && c.id === id
      );
      cards.push({
        id,
        hidden: Boolean(found?.hidden),
        pos: found?.pos ? sanitizePos(found.pos) : defaultPositionFor(id),
        chart_type:
          typeof found?.chart_type === "string" &&
          (CHART_TYPES as readonly string[]).includes(found.chart_type)
            ? (found.chart_type as ChartType)
            : undefined,
        filters: sanitizeFilters(found?.filters),
      });
    }
    return {
      version: 2,
      cards,
      default_company_id: sanitizeCompanyId(raw.default_company_id),
    };
  }

  if (looksLikeV1(raw)) {
    const visibleSet = new Set(
      raw.visible_cards.filter((v): v is DashboardCardId => allowed.has(v))
    );
    return {
      version: 2,
      cards: DASHBOARD_CARD_IDS.map((id) => ({
        id,
        hidden: !visibleSet.has(id),
        pos: defaultPositionFor(id),
      })),
      default_company_id: sanitizeCompanyId(raw.default_company_id),
    };
  }

  return DEFAULT_LAYOUT_V2;
}

function sanitizePos(raw: unknown): CardPosition | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  const out = {
    x: Math.max(0, Math.trunc(Number(r.x ?? 0))),
    y: Math.max(0, Math.trunc(Number(r.y ?? 0))),
    w: Math.max(1, Math.trunc(Number(r.w ?? 1))),
    h: Math.max(1, Math.trunc(Number(r.h ?? 1))),
  };
  if ([out.x, out.y, out.w, out.h].some((n) => !Number.isFinite(n))) {
    return undefined;
  }
  return out;
}

function sanitizeFilters(raw: unknown): CardFilters | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  const out: CardFilters = {};
  if (typeof r.company_id === "number" && Number.isFinite(r.company_id)) {
    out.company_id = r.company_id;
  } else if (r.company_id === null) {
    out.company_id = null;
  }
  if (typeof r.date_from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date_from)) {
    out.date_from = r.date_from;
  }
  if (typeof r.date_to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date_to)) {
    out.date_to = r.date_to;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizeCompanyId(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return null;
}
