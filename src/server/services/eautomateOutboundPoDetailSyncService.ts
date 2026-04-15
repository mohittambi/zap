import {
  eautomateConfigured,
  fetchEautomate,
  getEautomateBaseUrl,
} from "@/server/eautomate-proxy";
import {
  replaceOutboundPoEautomateFiles,
  updateOutboundPoListingsSnapshot,
  upsertOutboundPoFromEautomateDetail,
} from "@/server/services/outboundPurchaseOrdersService";

function unwrapIncomingPoDetail(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const o = data as Record<string, unknown>;
  if (o.data && typeof o.data === "object" && !Array.isArray(o.data)) {
    return o.data as Record<string, unknown>;
  }
  return o;
}

function extractFileRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.content)) return o.content;
  }
  return [];
}

function analyticsObjectEmpty(ao: unknown): boolean {
  if (!ao || typeof ao !== "object" || Array.isArray(ao)) return true;
  return Object.keys(ao as Record<string, unknown>).length === 0;
}

/**
 * Live pull from eAutomate: PO header + analytics + file list, persisted to Zap DB.
 */
export async function syncOutboundPurchaseOrderDetailFromEautomate(
  poNumber: string
): Promise<{ ok: boolean; message?: string }> {
  const pn = poNumber.trim();
  if (!pn) return { ok: false, message: "Missing PO number" };
  if (!eautomateConfigured()) {
    return { ok: false, message: "eAutomate not configured (cookie or bearer)" };
  }

  const base = getEautomateBaseUrl();
  const opt = { cache: "no-store" as const, signal: AbortSignal.timeout(120_000) };
  const warnings: string[] = [];

  const detailUrl = `${base}/public/api/incoming_purchase_orders/${encodeURIComponent(pn)}`;
  const dRes = await fetchEautomate(detailUrl, opt);
  if (!dRes.ok) {
    const t = await dRes.text().catch(() => "");
    return {
      ok: false,
      message: `Detail HTTP ${dRes.status} ${t.slice(0, 200)}`,
    };
  }
  const detailJson: unknown = await dRes.json();
  const detail =
    unwrapIncomingPoDetail(detailJson) ??
    (detailJson && typeof detailJson === "object" && !Array.isArray(detailJson)
      ? (detailJson as Record<string, unknown>)
      : null);
  if (!detail || detail.id == null) {
    return { ok: false, message: "Invalid PO detail JSON" };
  }

  if (analyticsObjectEmpty(detail.analytics_object)) {
    const aoUrl = `${base}/public/api/incoming_purchase_orders/analytics_object/${encodeURIComponent(pn)}`;
    const aoRes = await fetchEautomate(aoUrl, opt);
    if (aoRes.ok) {
      try {
        const aoJson: unknown = await aoRes.json();
        if (aoJson && typeof aoJson === "object" && !Array.isArray(aoJson)) {
          detail.analytics_object = aoJson as Record<string, unknown>;
        }
      } catch {
        warnings.push("analytics_object response was not valid JSON");
      }
    } else {
      const t = await aoRes.text().catch(() => "");
      warnings.push(`analytics_object HTTP ${aoRes.status} ${t.slice(0, 120)}`);
    }
  }

  const filesUrl = `${base}/public/api/incoming_purchase_orders/fetch_po_detail_files/${encodeURIComponent(pn)}`;
  const fRes = await fetchEautomate(filesUrl, opt);
  if (!fRes.ok) {
    const t = await fRes.text().catch(() => "");
    return {
      ok: false,
      message: `Files HTTP ${fRes.status} ${t.slice(0, 200)}`,
    };
  }
  const filesJson: unknown = await fRes.json();
  const fileRows = extractFileRows(filesJson);

  await upsertOutboundPoFromEautomateDetail(detail);
  const id = Number(detail.id);
  if (!Number.isFinite(id) || id < 1) {
    return { ok: false, message: "Invalid PO id in detail" };
  }
  await replaceOutboundPoEautomateFiles(id, String(detail.po_number ?? pn).slice(0, 80), fileRows);

  const listingsUrl = `${base}/public/api/incoming_purchase_orders/listings/paginated/${encodeURIComponent(pn)}?search_keyword=&page=1&count=1000`;
  const lRes = await fetchEautomate(listingsUrl, opt);
  if (!lRes.ok) {
    const t = await lRes.text().catch(() => "");
    warnings.push(`Listings HTTP ${lRes.status} ${t.slice(0, 120)}`);
  } else {
    try {
      const listingsJson: unknown = await lRes.json();
      await updateOutboundPoListingsSnapshot(id, listingsJson);
    } catch {
      warnings.push("Listings response was not valid JSON");
    }
  }

  return {
    ok: true,
    message: warnings.length > 0 ? warnings.join("; ") : undefined,
  };
}
