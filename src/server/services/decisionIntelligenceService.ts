import { rankInsights } from "@/lib/insightRanking";
import type { Insight, InsightConfig, InsightDraft } from "@/lib/insightTypes";
import { getHomeSummary } from "./homeSummaryService";
import { getInsightConfig } from "./insightConfigService";
import { getActiveFeedback } from "./insightFeedbackService";
import { getSkuForecastBundle } from "./insightsForecastService";
import { getReorderMetrics } from "./reorderService";
import { getVendorReliabilityScores } from "./insightVendorService";

function buildInventoryInsights(
  summary: Awaited<ReturnType<typeof getHomeSummary>>,
  reorderRows: Awaited<ReturnType<typeof getReorderMetrics>>["data"],
  config: InsightConfig
): InsightDraft[] {
  const drafts: InsightDraft[] = [];

  for (const row of summary.stockout_risk) {
    const burn = row.sold_30d / 30;
    const orderQty = Math.max(
      0,
      Math.ceil(burn * 14 - row.available_qty)
    );
    drafts.push({
      rule: "stockout_risk",
      domain: "INVENTORY",
      severity: row.days_of_cover != null && row.days_of_cover < 7 ? "CRITICAL" : "WARNING",
      title: `Stockout risk: ${row.sku_id}`,
      rationale: `${row.days_of_cover?.toFixed(1) ?? "?"} days of cover; ${row.sold_30d} sold in 30d; ${row.available_qty} on hand.`,
      recommended_action: `Reorder ~${orderQty} units for ${row.sku_id}.`,
      impact_value: row.sold_30d * 100,
      entity: { type: "SKU", id: row.sku_id },
      urgency: row.days_of_cover != null ? 14 / Math.max(row.days_of_cover, 0.5) : 2,
      raw: { ...row },
    });
  }

  for (const row of summary.dead_stock) {
    drafts.push({
      rule: "dead_stock",
      domain: "INVENTORY",
      severity: "WARNING",
      title: `Dead stock: ${row.sku_id}`,
      rationale: `${row.available_qty} units on hand; ${row.days_since_last_sale ?? "no"} days since last sale.`,
      recommended_action: "Consider discounting or liquidating slow-moving inventory.",
      impact_value: row.available_qty * 50,
      entity: { type: "SKU", id: row.sku_id },
      raw: { ...row },
    });
  }

  for (const row of reorderRows.filter((r) => r.is_below_reorder)) {
    drafts.push({
      rule: "below_reorder",
      domain: "INVENTORY",
      severity: "WARNING",
      title: `Below reorder point: ${row.sku_id}`,
      rationale: `Available ${row.available_qty} < min reorder ${row.min_reorder_qty}; sold 30d ${row.sold_30d}.`,
      recommended_action: "Raise a purchase order to replenish this SKU.",
      impact_value: row.sold_30d * 80,
      entity: { type: "SKU", id: row.sku_id },
      raw: { ...row },
    });
  }

  return drafts;
}

function buildProcurementInsights(
  summary: Awaited<ReturnType<typeof getHomeSummary>>,
  vendors: Awaited<ReturnType<typeof getVendorReliabilityScores>>
): InsightDraft[] {
  const drafts: InsightDraft[] = [];

  if (summary.ops_queues.audit_pending > 0) {
    drafts.push({
      rule: "queue_audit_backlog",
      domain: "PROCUREMENT",
      severity: summary.ops_queues.audit_pending > 20 ? "CRITICAL" : "WARNING",
      title: "Pending audits backlog",
      rationale: `${summary.ops_queues.audit_pending} GRNs awaiting audit close.`,
      recommended_action: "Clear the pending audit queue to unblock downstream accounts.",
      impact_value: summary.ops_queues.audit_pending * 500,
      entity: { type: "QUEUE", id: "audit" },
    });
  }

  if (summary.ops_queues.invoice_collection_pending > 0) {
    drafts.push({
      rule: "queue_invoice_backlog",
      domain: "PROCUREMENT",
      severity: "WARNING",
      title: "Pending invoice collection backlog",
      rationale: `${summary.ops_queues.invoice_collection_pending} GRNs awaiting physical invoice copy.`,
      recommended_action: "Mark invoice copies collected for pending GRNs.",
      impact_value: summary.ops_queues.invoice_collection_pending * 300,
      entity: { type: "QUEUE", id: "invoice_collection" },
    });
  }

  if (summary.ops_queues.debit_credit_notes_pending > 0) {
    drafts.push({
      rule: "queue_dcn_backlog",
      domain: "PROCUREMENT",
      severity: "WARNING",
      title: "Pending debit/credit notes",
      rationale: `${summary.ops_queues.debit_credit_notes_pending} notes awaiting decision.`,
      recommended_action: "Review and accept/decline pending debit/credit notes.",
      impact_value: summary.ops_queues.debit_credit_notes_pending * 400,
      entity: { type: "QUEUE", id: "dcn" },
    });
  }

  if (summary.open_pos.aged_over_7d > 0) {
    drafts.push({
      rule: "aged_open_pos",
      domain: "PROCUREMENT",
      severity: "WARNING",
      title: "Aged open outbound POs",
      rationale: `${summary.open_pos.aged_over_7d} of ${summary.open_pos.open} open POs are older than 7 days.`,
      recommended_action: "Expedite fulfillment or follow up on stale purchase orders.",
      impact_value: summary.open_pos.aged_over_7d * 1000,
      entity: { type: "PO", id: "outbound_open" },
    });
  }

  const shortageDelta = summary.vendor_quality.shortage_rate_pct.delta_mom_pct;
  if (shortageDelta != null && shortageDelta > 5) {
    drafts.push({
      rule: "vendor_shortage_spike",
      domain: "PROCUREMENT",
      severity: "WARNING",
      title: "Vendor shortage rate rising",
      rationale: `Shortage rate MoM +${shortageDelta.toFixed(1)}% (now ${summary.vendor_quality.shortage_rate_pct.value.toFixed(1)}%).`,
      recommended_action: "Review vendor receipts and raise debit notes where warranted.",
      impact_value: Math.abs(shortageDelta) * 200,
      entity: { type: "VENDOR", id: "aggregate" },
    });
  }

  for (const v of vendors.filter((x) => x.band === "HIGH_RISK" || x.band === "REVIEW")) {
    drafts.push({
      rule: "vendor_reliability",
      domain: "PROCUREMENT",
      severity: v.band === "HIGH_RISK" ? "CRITICAL" : "WARNING",
      title: `Vendor review: ${v.vendor_name}`,
      rationale: `Reliability score ${v.score}; acceptance ${v.acceptance_rate_pct.toFixed(1)}%; shortage ${v.shortage_rate_pct.toFixed(1)}%.`,
      recommended_action: "Schedule vendor quality review and tighten receiving checks.",
      impact_value: (100 - v.score) * 50,
      entity: { type: "VENDOR", id: String(v.vendor_id) },
      raw: { ...v },
    });
  }

  return drafts;
}

function buildSalesInsights(
  summary: Awaited<ReturnType<typeof getHomeSummary>>
): InsightDraft[] {
  const drafts: InsightDraft[] = [];

  const fillDelta = summary.kpis.fill_rate_pct.delta_mom_pct;
  if (fillDelta != null && fillDelta < -3) {
    drafts.push({
      rule: "fill_rate_drop",
      domain: "SALES",
      severity: "WARNING",
      title: "Fill rate declining",
      rationale: `Fill rate MoM ${fillDelta.toFixed(1)}% (now ${summary.kpis.fill_rate_pct.value.toFixed(1)}%).`,
      recommended_action: "Investigate consignment fulfillment and stock availability.",
      impact_value: Math.abs(fillDelta) * 500,
      entity: { type: "PO", id: "fill_rate" },
    });
  }

  const anomalies = summary.trends.sales_qty_daily.filter(
    (p) => p.anomaly_z != null
  );
  if (anomalies.length > 0) {
    const latest = anomalies[anomalies.length - 1];
    drafts.push({
      rule: "sales_anomaly",
      domain: "SALES",
      severity: Math.abs(latest.anomaly_z ?? 0) > 3 ? "CRITICAL" : "WARNING",
      title: "Sales volume anomaly detected",
      rationale: `Unusual sales on ${latest.day} (z=${latest.anomaly_z?.toFixed(2)}).`,
      recommended_action: "Review demand signal and channel activity for that day.",
      impact_value: Math.abs(latest.anomaly_z ?? 0) * 300,
      entity: { type: "PO", id: `anomaly_${latest.day}` },
      raw: { ...latest },
    });
  }

  if (summary.channel_mix && summary.channel_mix.length > 0) {
    const total = summary.channel_mix.reduce((s, r) => s + r.qty, 0) || 1;
    const top = summary.channel_mix[0];
    const share = (top.qty / total) * 100;
    if (share > 60) {
      drafts.push({
        rule: "channel_concentration",
        domain: "SALES",
        severity: "INFO",
        title: `Channel concentration: ${top.company}`,
        rationale: `${top.company} represents ${share.toFixed(1)}% of outbound volume.`,
        recommended_action: "Diversify channel mix to reduce dependency risk.",
        impact_value: share * 10,
        entity: { type: "PO", id: top.company },
      });
    }
  }

  return drafts;
}

async function buildSmartReorderInsights(
  reorderRows: Awaited<ReturnType<typeof getReorderMetrics>>["data"],
  config: InsightConfig
): Promise<InsightDraft[]> {
  const drafts: InsightDraft[] = [];
  const candidates = reorderRows.filter((r) => r.is_below_reorder).slice(0, 10);

  for (const row of candidates) {
    try {
      const bundle = await getSkuForecastBundle(row.sku_id);
      const rec = bundle.smart_reorder;
      if (rec.suggested_order_qty <= 0) continue;
      drafts.push({
        rule: "smart_reorder",
        domain: "INVENTORY",
        severity: "INFO",
        title: `Smart reorder: ${row.sku_id}`,
        rationale: `EOQ ${rec.eoq}, safety stock ${rec.safety_stock}, reorder point ${rec.reorder_point}; forecast method ${bundle.forecast.method}.`,
        recommended_action: `Order ${rec.suggested_order_qty} units (safety-stock + EOQ model).`,
        impact_value: rec.suggested_order_qty * (bundle.unit_cost || 50),
        entity: { type: "SKU", id: row.sku_id },
        raw: { rec, forecast_method: bundle.forecast.method },
      });
    } catch {
      /* skip SKU on error */
    }
  }

  return drafts;
}

export async function buildInsightDrafts(
  config: InsightConfig
): Promise<InsightDraft[]> {
  const [summary, reorder, vendors] = await Promise.all([
    getHomeSummary({}),
    getReorderMetrics({ alertsOnly: true, page: 1, limit: 50 }),
    getVendorReliabilityScores(30),
  ]);

  const drafts = [
    ...buildInventoryInsights(summary, reorder.data, config),
    ...buildProcurementInsights(summary, vendors),
    ...buildSalesInsights(summary),
    ...(await buildSmartReorderInsights(reorder.data, config)),
  ];

  return drafts;
}

export async function getRankedInsights(opts?: {
  domain?: string;
  severity?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  total: number;
  page: number;
  per_page_count: number;
  content: Insight[];
}> {
  const config = await getInsightConfig();
  const feedback = await getActiveFeedback();
  const drafts = await buildInsightDrafts(config);
  let ranked = rankInsights(drafts, config, feedback);

  if (opts?.domain) {
    ranked = ranked.filter((i) => i.domain === opts.domain);
  }
  if (opts?.severity) {
    ranked = ranked.filter((i) => i.severity === opts.severity);
  }
  if (opts?.search?.trim()) {
    const q = opts.search.trim().toLowerCase();
    ranked = ranked.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.rationale.toLowerCase().includes(q) ||
        i.entity?.id.toLowerCase().includes(q)
    );
  }

  const page = opts?.page ?? 1;
  const limit = opts?.limit ?? 50;
  const offset = (page - 1) * limit;
  const slice = ranked.slice(offset, offset + limit);

  return {
    total: ranked.length,
    page,
    per_page_count: limit,
    content: slice,
  };
}

export async function getInsightsSummary() {
  const [home, worklist] = await Promise.all([
    getHomeSummary({}),
    getRankedInsights({ limit: 500 }),
  ]);

  const by_domain: Record<string, number> = {};
  const by_severity: Record<string, number> = {};
  for (const ins of worklist.content) {
    by_domain[ins.domain] = (by_domain[ins.domain] ?? 0) + 1;
    by_severity[ins.severity] = (by_severity[ins.severity] ?? 0) + 1;
  }

  return {
    home_kpis: home.kpis,
    ops_queues: home.ops_queues,
    insight_counts: {
      total: worklist.total,
      by_domain,
      by_severity,
    },
    top_insights: worklist.content.slice(0, 5),
  };
}
