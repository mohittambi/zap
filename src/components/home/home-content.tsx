"use client";

import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-browser";
import { AppPageShell, AppPageTitle } from "@/components/layout/app-page-shell";
import { HomeFilters } from "@/components/home/home-filters";
import { CardFrame } from "@/components/home/card-frame";
import { CardDetailSheet } from "@/components/home/card-detail-sheet";
import { CardFilterForm } from "@/components/home/card-filter-form";
import { CustomiseDashboardSheet } from "@/components/home/customise-dashboard-sheet";
import { DashboardGrid } from "@/components/home/dashboard-grid";
import { ShareLayoutButton } from "@/components/home/share-layout-button";
import { KpiCardBody } from "@/components/home/kpi-card";
import { TrendChartBody } from "@/components/home/trend-chart";
import { ChannelMixBody } from "@/components/home/channel-mix-card";
import { OpsQueuesBody } from "@/components/home/ops-queues-card";
import { OpenPosBody } from "@/components/home/open-pos-card";
import { VendorQualityBody } from "@/components/home/vendor-quality-card";
import { InventorySnapshotBody } from "@/components/home/inventory-snapshot-card";
import { ReorderAlertsBody } from "@/components/home/reorder-alerts-strip";
import { SkuMovementBody } from "@/components/home/sku-movement-card";
import { DeadStockBody } from "@/components/home/dead-stock-card";
import { StockoutRiskBody } from "@/components/home/stockout-risk-card";
import { SkuVelocityBucketsBody } from "@/components/home/sku-velocity-buckets-card";
import { SavedQueryPanel } from "@/components/home/saved-query-panel";
import { CustomQueryCard } from "@/components/home/custom-query-card";
import { useHomeSummary } from "@/hooks/use-home-summary";
import { useDashboardPrefs } from "@/hooks/use-dashboard-prefs";
import { formatIstRangeInclusive } from "@/lib/format-ist";
import { downloadCsv, stampedCsvName } from "@/lib/dashboard-csv";
import { buildShareUrl, readLayoutFromHash } from "@/lib/share-layout";
import {
  type CardFilters,
  type ChartType,
  type DashboardCardId,
} from "@/lib/dashboard-card-ids";
import type { CardAction } from "@/components/home/card-actions-menu";
import type { HomeSummary } from "@/server/services/homeSummaryService";

type Company = { id: number; name: string };

const CARD_TITLES: Record<DashboardCardId, string> = {
  sales_qty: "Sales orders (qty)",
  sales_pos: "Sales POs raised",
  fill_rate_pct: "Avg fill rate",
  inbound_qty: "Inbound received (qty)",
  skus_below_reorder: "SKUs below reorder",
  gmv_value_30d: "GMV value (30d)",
  ops_queues: "Ops queues",
  open_pos: "Open sales POs",
  vendor_quality: "Vendor quality (30d)",
  inventory_snapshot: "Inventory snapshot",
  sku_velocity_buckets: "SKU velocity",
  trends: "Trends — sales & inbound",
  channel_mix: "Channel mix — top 5 (30d)",
  reorder_alerts_strip: "Reorder alerts",
  sku_movement: "SKU movement (30 / 60 / 90 d)",
  stockout_risk: "Stockout risk",
  dead_stock: "Dead stock",
  saved_query_panel: "Saved queries",
  custom_query: "Query builder",
};

const CARD_DESCRIPTIONS: Partial<Record<DashboardCardId, string>> = {
  sales_qty: "Units shipped (RTD)",
  sales_pos: "By PO issue date",
  fill_rate_pct: "Weighted by qty",
  inbound_qty: "GRN accepted",
  skus_below_reorder: "Live alert count",
  gmv_value_30d: "Dispatched MRP value",
  ops_queues: "Pending action",
  open_pos: "OPEN + ACK PENDING",
  vendor_quality: "GRN ratios",
  inventory_snapshot: "Live, point-in-time",
  sku_velocity_buckets: "Catalogue health (30d)",
  trends: "Trailing 90 days vs prior year",
  channel_mix: "Units shipped per company",
  reorder_alerts_strip: "Top SKUs below threshold",
  sku_movement: "Top movers, switch window to re-sort",
  stockout_risk: "<14 days of cover at current burn rate",
  dead_stock: "On hand, no sale in 60+ days",
  saved_query_panel: "Pick a curated query, run it",
  custom_query: "Write SQL with {{from}}, {{to}}, {{min_val}}, {{max_val}} placeholders",
};

type ChartCapableCard = "trends" | "channel_mix" | "sales_qty" | "sales_pos" | "inbound_qty";
const CHART_OPTIONS: Record<ChartCapableCard, { default: ChartType; options: ChartType[] }> = {
  trends: { default: "line", options: ["line", "bar", "area"] },
  channel_mix: { default: "bar", options: ["bar", "line"] },
  sales_qty: { default: "line", options: ["line", "sparkline"] },
  sales_pos: { default: "line", options: ["line", "sparkline"] },
  inbound_qty: { default: "line", options: ["line", "sparkline"] },
};

function withCompanyParam(base: string, companyId: number | null | undefined) {
  if (companyId == null) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}company_id=${companyId}`;
}

export function HomeContent() {
  const [companyId, setCompanyId] = React.useState<number | null>(null);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const { data, loading, refresh } = useHomeSummary(companyId);
  const {
    layout,
    saving,
    isVisible,
    getCardConfig,
    setHidden,
    setChartType,
    setCardFilters,
    save,
    resetLayout,
    updatePositions,
    enterPreview,
    exitPreviewAndPersist,
    exitPreviewAndDiscard,
    previewMode,
  } = useDashboardPrefs();

  // Detail-sheet + per-card-filter dialog state.
  const [detailFor, setDetailFor] = React.useState<DashboardCardId | null>(null);
  const [filterFor, setFilterFor] = React.useState<DashboardCardId | null>(null);

  // Read shared-layout fragment on mount.
  React.useEffect(() => {
    const shared = readLayoutFromHash();
    if (shared) enterPreview(shared);
  }, [enterPreview]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<{ companies: Company[] }>("/api/home/companies");
        if (!cancelled) setCompanies(res.companies);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const subtitle = data
    ? `Trailing 30 days (${formatIstRangeInclusive(data.range.from, data.range.to)} IST). Drag, resize, and configure each card.`
    : "Drag, resize, and configure each card.";

  function handleChannelBarClick(name: string) {
    const match = companies.find((c) => c.name === name);
    if (match) setCompanyId(match.id);
  }

  // ── Card action handler ────────────────────────────────────────────────────
  const handleCardAction = React.useCallback(
    (id: DashboardCardId, action: CardAction) => {
      switch (action) {
        case "refresh":
          void refresh();
          toast.success(`Refreshing ${CARD_TITLES[id]}…`);
          return;
        case "expand":
          setDetailFor(id);
          return;
        case "filter":
          setFilterFor(id);
          return;
        case "hide":
          setHidden(id, true);
          toast.success(`Hidden — restore from Customise.`);
          return;
        case "copy_link":
          void navigator.clipboard
            .writeText(buildShareUrl(layout))
            .then(() => toast.success("Layout link copied"))
            .catch(() => toast.error("Couldn't copy"));
          return;
        case "export":
          exportCardCsv(id, data);
          return;
      }
    },
    [layout, data, refresh, setHidden]
  );

  // ── Default action sets per card ──────────────────────────────────────────
  const baseActions: CardAction[] = ["refresh", "expand", "export", "copy_link", "filter", "hide"];
  const noFilterActions: CardAction[] = ["refresh", "expand", "export", "copy_link", "hide"];

  // ── Renderers map ─────────────────────────────────────────────────────────
  const renderers: Partial<Record<DashboardCardId, React.ReactNode>> = {};

  if (isVisible("sales_qty")) {
    const cfg = getCardConfig("sales_qty");
    const ct = cfg.chart_type ?? CHART_OPTIONS.sales_qty.default;
    renderers.sales_qty = (
      <CardFrame
        title={CARD_TITLES.sales_qty}
        description={CARD_DESCRIPTIONS.sales_qty}
        filterActive={!!cfg.filters && Object.keys(cfg.filters).length > 0}
        onClearFilter={() => setCardFilters(cfg.id, undefined)}
        chartType={{
          value: ct,
          options: CHART_OPTIONS.sales_qty.options,
          onChange: (t) => setChartType("sales_qty", t),
        }}
        actions={{ available: baseActions, onAction: (a) => handleCardAction("sales_qty", a) }}
      >
        <KpiCardBody
          value={data?.kpis.sales_qty.value ?? null}
          delta_mom_pct={data?.kpis.sales_qty.delta_mom_pct ?? null}
          delta_yoy_pct={data?.kpis.sales_qty.delta_yoy_pct ?? null}
          loading={loading}
          href={withCompanyParam("/outbound", companyId)}
          sparkline={ct === "sparkline" ? data?.trends.sales_qty_daily : undefined}
        />
      </CardFrame>
    );
  }

  if (isVisible("sales_pos")) {
    const cfg = getCardConfig("sales_pos");
    const ct = cfg.chart_type ?? CHART_OPTIONS.sales_pos.default;
    renderers.sales_pos = (
      <CardFrame
        title={CARD_TITLES.sales_pos}
        description={CARD_DESCRIPTIONS.sales_pos}
        filterActive={!!cfg.filters && Object.keys(cfg.filters).length > 0}
        onClearFilter={() => setCardFilters(cfg.id, undefined)}
        chartType={{
          value: ct,
          options: CHART_OPTIONS.sales_pos.options,
          onChange: (t) => setChartType("sales_pos", t),
        }}
        actions={{ available: baseActions, onAction: (a) => handleCardAction("sales_pos", a) }}
      >
        <KpiCardBody
          value={data?.kpis.sales_pos.value ?? null}
          delta_mom_pct={data?.kpis.sales_pos.delta_mom_pct ?? null}
          delta_yoy_pct={data?.kpis.sales_pos.delta_yoy_pct ?? null}
          loading={loading}
          href={withCompanyParam("/outbound", companyId)}
          sparkline={ct === "sparkline" ? data?.trends.sales_qty_daily : undefined}
        />
      </CardFrame>
    );
  }

  if (isVisible("fill_rate_pct")) {
    const cfg = getCardConfig("fill_rate_pct");
    renderers.fill_rate_pct = (
      <CardFrame
        title={CARD_TITLES.fill_rate_pct}
        description={CARD_DESCRIPTIONS.fill_rate_pct}
        filterActive={!!cfg.filters && Object.keys(cfg.filters).length > 0}
        onClearFilter={() => setCardFilters(cfg.id, undefined)}
        actions={{ available: baseActions, onAction: (a) => handleCardAction("fill_rate_pct", a) }}
      >
        <KpiCardBody
          value={data?.kpis.fill_rate_pct.value ?? null}
          format="percent"
          delta_mom_pct={data?.kpis.fill_rate_pct.delta_mom_pct ?? null}
          delta_yoy_pct={data?.kpis.fill_rate_pct.delta_yoy_pct ?? null}
          loading={loading}
          href={withCompanyParam("/outbound", companyId)}
        />
      </CardFrame>
    );
  }

  if (isVisible("inbound_qty")) {
    const cfg = getCardConfig("inbound_qty");
    const ct = cfg.chart_type ?? CHART_OPTIONS.inbound_qty.default;
    renderers.inbound_qty = (
      <CardFrame
        title={CARD_TITLES.inbound_qty}
        description={
          companyId != null
            ? `${CARD_DESCRIPTIONS.inbound_qty} (across vendors)`
            : CARD_DESCRIPTIONS.inbound_qty
        }
        filterActive={!!cfg.filters && Object.keys(cfg.filters).length > 0}
        onClearFilter={() => setCardFilters(cfg.id, undefined)}
        chartType={{
          value: ct,
          options: CHART_OPTIONS.inbound_qty.options,
          onChange: (t) => setChartType("inbound_qty", t),
        }}
        actions={{ available: baseActions, onAction: (a) => handleCardAction("inbound_qty", a) }}
      >
        <KpiCardBody
          value={data?.kpis.inbound_qty.value ?? null}
          delta_mom_pct={data?.kpis.inbound_qty.delta_mom_pct ?? null}
          delta_yoy_pct={data?.kpis.inbound_qty.delta_yoy_pct ?? null}
          loading={loading}
          href="/inbound"
          sparkline={ct === "sparkline" ? data?.trends.inbound_qty_daily : undefined}
        />
      </CardFrame>
    );
  }

  if (isVisible("skus_below_reorder")) {
    renderers.skus_below_reorder = (
      <CardFrame
        title={CARD_TITLES.skus_below_reorder}
        description={CARD_DESCRIPTIONS.skus_below_reorder}
        actions={{ available: noFilterActions, onAction: (a) => handleCardAction("skus_below_reorder", a) }}
      >
        <KpiCardBody
          value={data?.kpis.skus_below_reorder.value ?? null}
          delta_mom_pct={null}
          delta_yoy_pct={null}
          loading={loading}
          href="/reorder"
        />
      </CardFrame>
    );
  }

  if (isVisible("ops_queues")) {
    renderers.ops_queues = (
      <CardFrame
        title={CARD_TITLES.ops_queues}
        description={CARD_DESCRIPTIONS.ops_queues}
        actions={{ available: noFilterActions, onAction: (a) => handleCardAction("ops_queues", a) }}
      >
        <OpsQueuesBody queues={data?.ops_queues} loading={loading} />
      </CardFrame>
    );
  }

  if (isVisible("open_pos")) {
    const cfg = getCardConfig("open_pos");
    const openPosHref =
      companyId != null
        ? `/outbound?company_id=${companyId}`
        : "/outbound";
    renderers.open_pos = (
      <CardFrame
        title={CARD_TITLES.open_pos}
        description={CARD_DESCRIPTIONS.open_pos}
        filterActive={!!cfg.filters && Object.keys(cfg.filters).length > 0}
        onClearFilter={() => setCardFilters(cfg.id, undefined)}
        actions={{ available: baseActions, onAction: (a) => handleCardAction("open_pos", a) }}
      >
        <OpenPosBody stat={data?.open_pos} loading={loading} href={openPosHref} />
      </CardFrame>
    );
  }

  if (isVisible("vendor_quality")) {
    renderers.vendor_quality = (
      <CardFrame
        title={CARD_TITLES.vendor_quality}
        description={CARD_DESCRIPTIONS.vendor_quality}
        actions={{ available: noFilterActions, onAction: (a) => handleCardAction("vendor_quality", a) }}
      >
        <VendorQualityBody vq={data?.vendor_quality} loading={loading} href="/inbound" />
      </CardFrame>
    );
  }

  if (isVisible("inventory_snapshot")) {
    renderers.inventory_snapshot = (
      <CardFrame
        title={CARD_TITLES.inventory_snapshot}
        description={
          companyId != null ? "Across catalogue" : CARD_DESCRIPTIONS.inventory_snapshot
        }
        actions={{ available: noFilterActions, onAction: (a) => handleCardAction("inventory_snapshot", a) }}
      >
        <InventorySnapshotBody snapshot={data?.inventory_snapshot} loading={loading} />
      </CardFrame>
    );
  }

  if (isVisible("trends")) {
    const cfg = getCardConfig("trends");
    const ct = cfg.chart_type ?? CHART_OPTIONS.trends.default;
    renderers.trends = (
      <CardFrame
        title={CARD_TITLES.trends}
        description={CARD_DESCRIPTIONS.trends}
        chartType={{
          value: ct,
          options: CHART_OPTIONS.trends.options,
          onChange: (t) => setChartType("trends", t),
        }}
        actions={{ available: baseActions, onAction: (a) => handleCardAction("trends", a) }}
      >
        <TrendChartBody
          data={data?.trends.sales_qty_daily ?? null}
          loading={loading}
          chartType={ct}
        />
      </CardFrame>
    );
  }

  if (isVisible("channel_mix") && companyId == null) {
    const cfg = getCardConfig("channel_mix");
    const ct = cfg.chart_type ?? CHART_OPTIONS.channel_mix.default;
    renderers.channel_mix = (
      <CardFrame
        title={CARD_TITLES.channel_mix}
        description={CARD_DESCRIPTIONS.channel_mix}
        chartType={{
          value: ct,
          options: CHART_OPTIONS.channel_mix.options,
          onChange: (t) => setChartType("channel_mix", t),
        }}
        actions={{ available: noFilterActions, onAction: (a) => handleCardAction("channel_mix", a) }}
      >
        <ChannelMixBody
          rows={data?.channel_mix ?? null}
          loading={loading}
          chartType={ct}
          onCompanyClick={handleChannelBarClick}
        />
      </CardFrame>
    );
  }

  if (isVisible("reorder_alerts_strip")) {
    renderers.reorder_alerts_strip = (
      <CardFrame
        title={CARD_TITLES.reorder_alerts_strip}
        description={CARD_DESCRIPTIONS.reorder_alerts_strip}
        actions={{ available: noFilterActions, onAction: (a) => handleCardAction("reorder_alerts_strip", a) }}
      >
        <ReorderAlertsBody data={data} loading={loading} />
      </CardFrame>
    );
  }

  if (isVisible("gmv_value_30d")) {
    const cfg = getCardConfig("gmv_value_30d");
    renderers.gmv_value_30d = (
      <CardFrame
        title={CARD_TITLES.gmv_value_30d}
        description={CARD_DESCRIPTIONS.gmv_value_30d}
        filterActive={!!cfg.filters && Object.keys(cfg.filters).length > 0}
        onClearFilter={() => setCardFilters(cfg.id, undefined)}
        actions={{ available: baseActions, onAction: (a) => handleCardAction("gmv_value_30d", a) }}
      >
        <KpiCardBody
          value={data?.kpis.gmv_value_30d.value ?? null}
          delta_mom_pct={data?.kpis.gmv_value_30d.delta_mom_pct ?? null}
          delta_yoy_pct={data?.kpis.gmv_value_30d.delta_yoy_pct ?? null}
          loading={loading}
          href={withCompanyParam("/outbound", companyId)}
        />
      </CardFrame>
    );
  }

  if (isVisible("sku_velocity_buckets")) {
    renderers.sku_velocity_buckets = (
      <CardFrame
        title={CARD_TITLES.sku_velocity_buckets}
        description={CARD_DESCRIPTIONS.sku_velocity_buckets}
        actions={{ available: noFilterActions, onAction: (a) => handleCardAction("sku_velocity_buckets", a) }}
      >
        <SkuVelocityBucketsBody buckets={data?.sku_velocity} loading={loading} />
      </CardFrame>
    );
  }

  if (isVisible("sku_movement")) {
    renderers.sku_movement = (
      <CardFrame
        title={CARD_TITLES.sku_movement}
        description={CARD_DESCRIPTIONS.sku_movement}
        actions={{ available: noFilterActions, onAction: (a) => handleCardAction("sku_movement", a) }}
      >
        <SkuMovementBody rows={data?.sku_movement} loading={loading} />
      </CardFrame>
    );
  }

  if (isVisible("stockout_risk")) {
    renderers.stockout_risk = (
      <CardFrame
        title={CARD_TITLES.stockout_risk}
        description={CARD_DESCRIPTIONS.stockout_risk}
        actions={{ available: noFilterActions, onAction: (a) => handleCardAction("stockout_risk", a) }}
      >
        <StockoutRiskBody rows={data?.stockout_risk} loading={loading} />
      </CardFrame>
    );
  }

  if (isVisible("dead_stock")) {
    renderers.dead_stock = (
      <CardFrame
        title={CARD_TITLES.dead_stock}
        description={CARD_DESCRIPTIONS.dead_stock}
        actions={{ available: noFilterActions, onAction: (a) => handleCardAction("dead_stock", a) }}
      >
        <DeadStockBody rows={data?.dead_stock} loading={loading} />
      </CardFrame>
    );
  }

  if (isVisible("saved_query_panel")) {
    renderers.saved_query_panel = (
      <CardFrame
        title={CARD_TITLES.saved_query_panel}
        description={CARD_DESCRIPTIONS.saved_query_panel}
        actions={{ available: noFilterActions, onAction: (a) => handleCardAction("saved_query_panel", a) }}
      >
        <SavedQueryPanel />
      </CardFrame>
    );
  }

  if (isVisible("custom_query")) {
    renderers.custom_query = (
      <CardFrame
        title={CARD_TITLES.custom_query}
        description={CARD_DESCRIPTIONS.custom_query}
        actions={{ available: noFilterActions, onAction: (a) => handleCardAction("custom_query", a) }}
      >
        <CustomQueryCard />
      </CardFrame>
    );
  }

  return (
    <AppPageShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <AppPageTitle title="Operations overview" description={subtitle} className="mb-0" />
        <div className="flex items-center gap-2">
          {previewMode ? (
            <>
              <Badge variant="processing" className="h-6">Previewing shared layout</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void exitPreviewAndDiscard(layout)}
              >
                Discard
              </Button>
              <Button size="sm" onClick={() => void exitPreviewAndPersist()} disabled={saving}>
                Save as mine
              </Button>
            </>
          ) : (
            <>
              <ShareLayoutButton layout={layout} />
              <CustomiseDashboardSheet
                layout={layout}
                saving={saving}
                onSave={save}
                onReset={resetLayout}
              />
            </>
          )}
        </div>
      </div>
      <div className="mb-4">
        <HomeFilters companyId={companyId} onCompanyChange={setCompanyId} />
      </div>

      <DashboardGrid
        layout={layout}
        renderers={renderers}
        onPositionsChange={updatePositions}
        readOnly={previewMode}
      />

      {/* Detail sheet (Expand) */}
      <CardDetailSheet
        open={detailFor != null}
        title={detailFor ? CARD_TITLES[detailFor] : ""}
        description={detailFor ? CARD_DESCRIPTIONS[detailFor] : undefined}
        onClose={() => setDetailFor(null)}
      >
        {detailFor ? renderDetail(detailFor, data, loading, companyId) : null}
      </CardDetailSheet>

      {/* Per-card filter dialog */}
      <CardFilterForm
        open={filterFor != null}
        initial={filterFor ? getCardConfig(filterFor).filters : undefined}
        pageCompanyId={companyId}
        onClose={() => setFilterFor(null)}
        onSave={(filters: CardFilters) => {
          if (filterFor) setCardFilters(filterFor, filters);
        }}
        onClear={() => {
          if (filterFor) setCardFilters(filterFor, undefined);
        }}
      />
    </AppPageShell>
  );
}

function DetailWrap({
  source,
  href,
  children,
}: Readonly<{
  source: string;
  href?: string;
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>
          <span className="font-medium text-foreground">Source:</span> {source}
        </span>
        {href ? (
          <a
            href={href}
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Open full page →
          </a>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function renderDetail(
  id: DashboardCardId,
  data: HomeSummary | null,
  loading: boolean,
  companyId: number | null
): React.ReactNode {
  const withCompany = (base: string): string => withCompanyParam(base, companyId);

  switch (id) {
    case "trends":
      return (
        <DetailWrap source="Sales (RTD) vs prior year, last 90 days" href={withCompany("/outbound")}>
          <div className="h-[480px]">
            <TrendChartBody
              data={data?.trends.sales_qty_daily ?? null}
              loading={loading}
              chartType="line"
            />
          </div>
        </DetailWrap>
      );

    case "channel_mix":
      return (
        <DetailWrap source="Units shipped per company, last 30 days" href="/outbound">
          <div className="h-[480px]">
            <ChannelMixBody rows={data?.channel_mix ?? null} loading={loading} chartType="bar" />
          </div>
        </DetailWrap>
      );

    case "reorder_alerts_strip":
      return (
        <DetailWrap source="SKUs at or below their reorder threshold" href="/reorder">
          <ReorderAlertsBody data={data} loading={loading} />
        </DetailWrap>
      );

    case "sales_qty":
      return (
        <DetailWrap source="Units shipped (RTD), last 30 days" href={withCompany("/outbound")}>
          <KpiCardBody
            value={data?.kpis.sales_qty.value ?? null}
            delta_mom_pct={data?.kpis.sales_qty.delta_mom_pct ?? null}
            delta_yoy_pct={data?.kpis.sales_qty.delta_yoy_pct ?? null}
            loading={loading}
            href={withCompany("/outbound")}
            sparkline={data?.trends.sales_qty_daily}
          />
          <div className="h-[320px] pt-4">
            <TrendChartBody
              data={data?.trends.sales_qty_daily ?? null}
              loading={loading}
              chartType="line"
            />
          </div>
        </DetailWrap>
      );

    case "sales_pos":
      return (
        <DetailWrap source="Sales POs raised, by PO issue date (last 30 days)" href={withCompany("/outbound")}>
          <KpiCardBody
            value={data?.kpis.sales_pos.value ?? null}
            delta_mom_pct={data?.kpis.sales_pos.delta_mom_pct ?? null}
            delta_yoy_pct={data?.kpis.sales_pos.delta_yoy_pct ?? null}
            loading={loading}
            href={withCompany("/outbound")}
            sparkline={data?.trends.sales_qty_daily}
          />
        </DetailWrap>
      );

    case "fill_rate_pct":
      return (
        <DetailWrap source="Average fill rate, weighted by quantity" href={withCompany("/outbound")}>
          <KpiCardBody
            value={data?.kpis.fill_rate_pct.value ?? null}
            format="percent"
            delta_mom_pct={data?.kpis.fill_rate_pct.delta_mom_pct ?? null}
            delta_yoy_pct={data?.kpis.fill_rate_pct.delta_yoy_pct ?? null}
            loading={loading}
            href={withCompany("/outbound")}
          />
        </DetailWrap>
      );

    case "inbound_qty":
      return (
        <DetailWrap source="Inbound qty accepted on GRN, last 30 days" href="/inbound">
          <KpiCardBody
            value={data?.kpis.inbound_qty.value ?? null}
            delta_mom_pct={data?.kpis.inbound_qty.delta_mom_pct ?? null}
            delta_yoy_pct={data?.kpis.inbound_qty.delta_yoy_pct ?? null}
            loading={loading}
            href="/inbound"
            sparkline={data?.trends.inbound_qty_daily}
          />
          <div className="h-[320px] pt-4">
            <TrendChartBody
              data={data?.trends.inbound_qty_daily ?? null}
              loading={loading}
              chartType="line"
            />
          </div>
        </DetailWrap>
      );

    case "skus_below_reorder":
      return (
        <DetailWrap source="Live count of SKUs at or below the reorder threshold" href="/reorder">
          <KpiCardBody
            value={data?.kpis.skus_below_reorder.value ?? null}
            delta_mom_pct={null}
            delta_yoy_pct={null}
            loading={loading}
            href="/reorder"
          />
          <ReorderAlertsBody data={data} loading={loading} />
        </DetailWrap>
      );

    case "ops_queues":
      return (
        <DetailWrap source="Pending counts across audit, invoice collection, and DCN queues" href="/inbound">
          <OpsQueuesBody queues={data?.ops_queues} loading={loading} />
        </DetailWrap>
      );

    case "open_pos": {
      const openPosHref = withCompany("/outbound");
      return (
        <DetailWrap source="Outbound POs in OPEN or ACK PENDING state" href={openPosHref}>
          <OpenPosBody stat={data?.open_pos} loading={loading} href={openPosHref} />
        </DetailWrap>
      );
    }

    case "vendor_quality":
      return (
        <DetailWrap source="Vendor acceptance vs rejection vs shortage ratios, last 30 days" href="/inbound">
          <VendorQualityBody vq={data?.vendor_quality} loading={loading} href="/inbound" />
        </DetailWrap>
      );

    case "inventory_snapshot":
      return (
        <DetailWrap source="Live, point-in-time inventory across the catalogue" href="/listings/warehouse">
          <InventorySnapshotBody snapshot={data?.inventory_snapshot} loading={loading} />
        </DetailWrap>
      );

    case "gmv_value_30d":
      return (
        <DetailWrap source="Dispatched MRP value (consignment qty × MRP), last 30 days" href={withCompany("/outbound")}>
          <KpiCardBody
            value={data?.kpis.gmv_value_30d.value ?? null}
            delta_mom_pct={data?.kpis.gmv_value_30d.delta_mom_pct ?? null}
            delta_yoy_pct={data?.kpis.gmv_value_30d.delta_yoy_pct ?? null}
            loading={loading}
            href={withCompany("/outbound")}
          />
        </DetailWrap>
      );

    case "sku_velocity_buckets":
      return (
        <DetailWrap source="SKU counts bucketed by 30-day movement velocity" href="/reorder">
          <SkuVelocityBucketsBody buckets={data?.sku_velocity} loading={loading} />
        </DetailWrap>
      );

    case "sku_movement":
      return (
        <DetailWrap source="Top SKUs by movement — sort by 30/60/90 days" href="/reorder">
          <SkuMovementBody rows={data?.sku_movement} loading={loading} />
        </DetailWrap>
      );

    case "stockout_risk":
      return (
        <DetailWrap source="SKUs projected to run out within 14 days at current burn rate" href="/reorder">
          <StockoutRiskBody rows={data?.stockout_risk} loading={loading} />
        </DetailWrap>
      );

    case "dead_stock":
      return (
        <DetailWrap source="SKUs with on-hand stock but no SALE in last 60 days" href="/listings/warehouse">
          <DeadStockBody rows={data?.dead_stock} loading={loading} />
        </DetailWrap>
      );

    case "saved_query_panel":
      return (
        <DetailWrap source="Run-once curated queries">
          <SavedQueryPanel />
        </DetailWrap>
      );

    case "custom_query":
      return (
        <DetailWrap source="Ad-hoc SQL query">
          <CustomQueryCard />
        </DetailWrap>
      );

    default:
      /** Every known DashboardCardId is handled above; this branch is defensive only. */
      return (
        <p className="text-muted-foreground text-xs">No detail view for this card.</p>
      );
  }
}

// CSV export per card. Each card maps its visible data to columns + rows.
function exportCardCsv(id: DashboardCardId, data: HomeSummary | null): void {
  if (!data) {
    toast.error("No data to export yet.");
    return;
  }
  const name = stampedCsvName(id);
  switch (id) {
    case "trends":
      downloadCsv(name, ["day", "this_year", "last_year", "anomaly_z"], data.trends.sales_qty_daily.map((p) => [
        p.day,
        p.v,
        p.v_prev_year,
        p.anomaly_z,
      ]));
      return;
    case "channel_mix":
      downloadCsv(name, ["company", "qty"], (data.channel_mix ?? []).map((r) => [r.company, r.qty]));
      return;
    case "reorder_alerts_strip":
      downloadCsv(
        name,
        ["sku_id", "description", "available_qty", "min_reorder_qty", "sold_30d"],
        data.reorder_top.map((m) => [
          m.sku_id,
          m.description ?? "",
          m.available_qty,
          m.min_reorder_qty,
          m.sold_30d,
        ])
      );
      return;
    case "ops_queues":
      downloadCsv(name, ["queue", "count"], [
        ["audit_pending", data.ops_queues.audit_pending],
        ["invoice_collection_pending", data.ops_queues.invoice_collection_pending],
        ["debit_credit_notes_pending", data.ops_queues.debit_credit_notes_pending],
      ]);
      return;
    case "sku_movement":
      downloadCsv(
        name,
        ["sku_id", "description", "qty_30d", "qty_60d", "qty_90d", "available_qty"],
        data.sku_movement.map((m) => [
          m.sku_id,
          m.description ?? "",
          m.qty_30d,
          m.qty_60d,
          m.qty_90d,
          m.available_qty,
        ])
      );
      return;
    case "dead_stock":
      downloadCsv(
        name,
        ["sku_id", "description", "available_qty", "days_since_last_sale"],
        data.dead_stock.map((m) => [
          m.sku_id,
          m.description ?? "",
          m.available_qty,
          m.days_since_last_sale ?? "never",
        ])
      );
      return;
    case "stockout_risk":
      downloadCsv(
        name,
        ["sku_id", "description", "available_qty", "sold_30d", "days_of_cover"],
        data.stockout_risk.map((m) => [
          m.sku_id,
          m.description ?? "",
          m.available_qty,
          m.sold_30d,
          m.days_of_cover == null ? "" : m.days_of_cover.toFixed(2),
        ])
      );
      return;
    case "sku_velocity_buckets":
      downloadCsv(name, ["bucket", "count"], [
        ["fast", data.sku_velocity.fast],
        ["medium", data.sku_velocity.medium],
        ["slow", data.sku_velocity.slow],
        ["dead", data.sku_velocity.dead],
      ]);
      return;
    default: {
      // Generic KPI export.
      const map: Record<string, unknown[]> = {
        sales_qty: ["sales_qty", data.kpis.sales_qty.value],
        sales_pos: ["sales_pos", data.kpis.sales_pos.value],
        fill_rate_pct: ["fill_rate_pct", data.kpis.fill_rate_pct.value],
        inbound_qty: ["inbound_qty", data.kpis.inbound_qty.value],
        skus_below_reorder: ["skus_below_reorder", data.kpis.skus_below_reorder.value],
        open_pos: ["open_pos", data.open_pos.open],
        vendor_quality: ["acceptance_rate_pct", data.vendor_quality.acceptance_rate_pct.value],
        inventory_snapshot: ["units_on_hand", data.inventory_snapshot.units_on_hand],
        saved_query_panel: ["", ""],
        custom_query: ["", ""],
      };
      const row = map[id] ?? [id, ""];
      downloadCsv(name, ["metric", "value"], [row]);
    }
  }
}
