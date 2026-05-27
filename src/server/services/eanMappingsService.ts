import { query } from "@/server/db";

export type EanMappingRow = {
  id: number;
  sku_code: string;
  company_id: number;
  company_name: string | null;
  zap_ean: string | null;
  ean_type: string | null;
  universal_ean: string | null;
  created_at: string;
  updated_at: string;
};

export type ZapEanLookup = {
  /** Internal product SKU (`listings.master_sku` / warehouse sku_code). */
  sku_code: string;
  /** Company-specific code from dump (EAN, SKU code, item code, etc.). */
  channel_ean: string;
  universal_ean: string;
  ean_type: string;
};

/** Keys used to resolve `company_ean_mappings` for a PO line item. */
export function mappingSkuKeysFromRow(row: Record<string, unknown>): string[] {
  const keys: string[] = [];
  for (const field of ["master_sku", "inventory_sku_id", "sku_code"]) {
    const v = row[field];
    if (v != null && String(v).trim()) keys.push(String(v).trim());
  }
  /** Blinkit / marketplace PO spreadsheets: item code is stored in `zap_ean` on the mapping row. */
  const secondary = row.po_secondary_sku;
  if (secondary != null && String(secondary).trim()) {
    keys.push(String(secondary).trim());
  }
  const upc = row.product_upc;
  if (upc != null && String(upc).trim()) {
    keys.push(String(upc).trim());
  }
  return [...new Set(keys)];
}

/**
 * Value for the "Zap EAN" column on line items.
 * Avoid duplicating Company Code Primary when the channel mapping is a marketplace SKU/code.
 */
export function resolveZapEanDisplay(
  companyCodePrimary: string,
  hit: ZapEanLookup | undefined
): string {
  if (!hit) return "";
  const primary = companyCodePrimary.trim();
  const channel = hit.channel_ean.trim();
  const universal = hit.universal_ean.trim();
  if (hit.ean_type === "ean" && channel) return channel;
  if (channel && channel !== primary) return channel;
  return universal;
}

/** Resolve warehouse master SKU from company_ean_mappings via channel / PO item code. */
export function resolveMasterSkuFromEanMapping(
  channelOrPoSku: string,
  eanBySkuKey: Map<string, ZapEanLookup>
): string {
  const key = channelOrPoSku.trim();
  if (!key) return "";
  const hit = eanBySkuKey.get(key);
  return hit?.sku_code?.trim() ?? "";
}

export type ListingSkuFields = {
  master_sku: string;
  inventory_sku_id: string;
};

function strTrimSkuField(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s || s.toUpperCase() === "NA") return "";
  return s;
}

function pickListingNested(row: Record<string, unknown>): Record<string, unknown> | null {
  const l = row.listing;
  if (l && typeof l === "object" && !Array.isArray(l)) {
    return l as Record<string, unknown>;
  }
  return null;
}

/** Keys used to resolve listings / EAN / warehouse SKU for an outbound line item. */
export function outboundSkuLookupKeys(row: Record<string, unknown>): string[] {
  const keys = new Set<string>();
  const add = (v: unknown) => {
    const s = strTrimSkuField(v);
    if (s) keys.add(s);
  };
  add(row.master_sku);
  add(row.inventory_sku_id);
  add(row.pack_combo_sku_id);
  add(row.po_secondary_sku);
  add(row.sku_id);
  add(row.product_upc);
  const listing = pickListingNested(row);
  if (listing) {
    add(listing.sku_id);
    add(listing.master_sku);
    add(listing.inventory_sku_id);
  }
  for (const k of mappingSkuKeysFromRow(row)) {
    if (k) keys.add(k);
  }
  return [...keys];
}

export function resolveListingSkuFieldsFromMap(
  row: Record<string, unknown>,
  listingSkuByKey: Map<string, ListingSkuFields>
): ListingSkuFields {
  for (const k of outboundSkuLookupKeys(row)) {
    const hit = listingSkuByKey.get(k);
    if (hit && (hit.master_sku || hit.inventory_sku_id)) return hit;
  }
  return { master_sku: "", inventory_sku_id: "" };
}

export async function batchListingSkuByKeys(
  keys: string[]
): Promise<Map<string, ListingSkuFields>> {
  const listingSkuByKey = new Map<string, ListingSkuFields>();
  const unique = [...new Set(keys.map((k) => String(k).trim()).filter(Boolean))];
  if (unique.length === 0) return listingSkuByKey;

  const listR = await query(
    `SELECT sku_id, master_sku, inventory_sku_id
       FROM listings
      WHERE sku_id = ANY($1::text[])
         OR master_sku = ANY($1::text[])
         OR inventory_sku_id = ANY($1::text[])`,
    [unique]
  );
  for (const dbRow of listR.rows as {
    sku_id: string | null;
    master_sku: string | null;
    inventory_sku_id: string | null;
  }[]) {
    const fields: ListingSkuFields = {
      master_sku: strTrimSkuField(dbRow.master_sku),
      inventory_sku_id: strTrimSkuField(dbRow.inventory_sku_id),
    };
    if (!fields.master_sku && !fields.inventory_sku_id) continue;
    for (const id of [dbRow.sku_id, dbRow.master_sku, dbRow.inventory_sku_id]) {
      const k = strTrimSkuField(id);
      if (k) listingSkuByKey.set(k, fields);
    }
  }
  return listingSkuByKey;
}

/** Product SKU fields for PO line items and pendency (not EAN barcodes). */
export function resolveOutboundLineItemProductSkuFields(
  row: Record<string, unknown>,
  eanBySkuKey: Map<string, ZapEanLookup>,
  listingSkuByKey: Map<string, ListingSkuFields>
): { master_sku: string; company_code_primary: string; inventory_sku_id: string } {
  const secondarySku = strTrimSkuField(row.po_secondary_sku);
  const listing = pickListingNested(row);
  const fromListings = resolveListingSkuFieldsFromMap(row, listingSkuByKey);
  const fromEan = resolveMasterSkuFromEanMapping(secondarySku, eanBySkuKey);

  const rawCcp = strTrimSkuField(row.company_code_primary);
  const topLevelCode =
    rawCcp && rawCcp !== secondarySku ? rawCcp : "";

  const masterSku =
    strTrimSkuField(row.master_sku) ||
    strTrimSkuField(listing?.master_sku) ||
    fromListings.master_sku ||
    fromEan;

  const inventorySkuId =
    strTrimSkuField(row.inventory_sku_id) ||
    strTrimSkuField(listing?.inventory_sku_id) ||
    fromListings.inventory_sku_id;

  const company_code_primary = topLevelCode || masterSku || inventorySkuId || "";

  return { master_sku: masterSku, company_code_primary, inventory_sku_id: inventorySkuId };
}

export type OutboundSkuLookups = {
  companyId: number | null;
  companyCodeBySecondarySku: Map<string, string>;
  eanBySkuKey: Map<string, ZapEanLookup>;
  listingSkuByKey: Map<string, ListingSkuFields>;
  binStockBySkuId: Map<string, number>;
};

/** Map channel / PO keys from EAN rows to product SKU for listings + bin resolution. */
export function seedListingSkuFromEanMappings(
  eanBySkuKey: Map<string, ZapEanLookup>,
  listingSkuByKey: Map<string, ListingSkuFields>
): void {
  for (const [key, hit] of eanBySkuKey) {
    const master = hit.sku_code?.trim();
    if (!master) continue;
    const apply = (mapKey: string) => {
      const existing = listingSkuByKey.get(mapKey);
      if (existing?.master_sku) return;
      listingSkuByKey.set(mapKey, {
        master_sku: master,
        inventory_sku_id: existing?.inventory_sku_id ?? "",
      });
    };
    if (key) apply(key);
    const channel = hit.channel_ean.trim();
    if (channel) apply(channel);
  }
}

function companyCodeFromSnapshotDetails(
  row: Record<string, unknown>,
  companyId: number | null
): string {
  if (companyId == null || !Number.isFinite(companyId) || companyId < 1) return "";
  const details = row.secondary_sku_company_details;
  if (!Array.isArray(details)) return "";
  for (const entry of details) {
    if (entry == null || typeof entry !== "object" || Array.isArray(entry)) continue;
    const o = entry as Record<string, unknown>;
    const cid = Number(o.company_id);
    if (!Number.isFinite(cid) || cid !== companyId) continue;
    const code = strTrimSkuField(o.company_code_primary);
    if (code) return code;
  }
  return "";
}

export function resolveOutboundCompanyCodePrimary(
  row: Record<string, unknown>,
  lookups: Pick<
    OutboundSkuLookups,
    "companyId" | "companyCodeBySecondarySku" | "eanBySkuKey" | "listingSkuByKey"
  >
): string {
  const secondarySku = strTrimSkuField(row.po_secondary_sku);
  const skuFields = resolveOutboundLineItemProductSkuFields(
    row,
    lookups.eanBySkuKey,
    lookups.listingSkuByKey
  );

  const rawTopLevel = strTrimSkuField(row.company_code_primary);
  const topLevelCode =
    rawTopLevel && rawTopLevel !== secondarySku ? rawTopLevel : "";

  const rawFromDb =
    secondarySku && lookups.companyCodeBySecondarySku.has(secondarySku)
      ? lookups.companyCodeBySecondarySku.get(secondarySku) ?? ""
      : "";
  const fromDb =
    rawFromDb && rawFromDb !== secondarySku ? rawFromDb : "";

  const rawFromDetails = companyCodeFromSnapshotDetails(row, lookups.companyId);
  const fromDetails =
    rawFromDetails && rawFromDetails !== secondarySku ? rawFromDetails : "";

  return (
    topLevelCode ||
    fromDb ||
    fromDetails ||
    skuFields.company_code_primary ||
    ""
  );
}

/** SKU ids to match Zap bin stock, in priority order. */
export function binSkuIdCandidatesForRow(
  row: Record<string, unknown>,
  lookups?: Pick<OutboundSkuLookups, "listingSkuByKey" | "eanBySkuKey">
): string[] {
  const listingSkuByKey = lookups?.listingSkuByKey ?? new Map();
  const eanBySkuKey = lookups?.eanBySkuKey ?? new Map();
  const listing = pickListingNested(row);
  const fromDb = resolveListingSkuFieldsFromMap(row, listingSkuByKey);
  const fromEan = resolveMasterSkuFromEanMapping(
    strTrimSkuField(row.po_secondary_sku),
    eanBySkuKey
  );
  const candidates = [
    strTrimSkuField(row.inventory_sku_id) ||
      strTrimSkuField(listing?.inventory_sku_id) ||
      fromDb.inventory_sku_id,
    strTrimSkuField(row.master_sku) ||
      strTrimSkuField(listing?.master_sku) ||
      fromDb.master_sku ||
      fromEan,
    strTrimSkuField(row.po_secondary_sku),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of candidates) {
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function collectBinSkuIdsForRows(
  rows: Record<string, unknown>[],
  lookups: Pick<OutboundSkuLookups, "listingSkuByKey" | "eanBySkuKey">
): string[] {
  return [
    ...new Set(rows.flatMap((r) => binSkuIdCandidatesForRow(r, lookups))),
  ];
}

export function resolveWarehouseQuantityFromLookups(
  row: Record<string, unknown>,
  lookups: Pick<OutboundSkuLookups, "listingSkuByKey" | "eanBySkuKey" | "binStockBySkuId">
): number | null {
  for (const skuId of binSkuIdCandidatesForRow(row, lookups)) {
    if (lookups.binStockBySkuId.has(skuId)) {
      return lookups.binStockBySkuId.get(skuId) ?? 0;
    }
  }
  return null;
}

export type EnrichedOutboundReportRow = {
  master_sku: string;
  company_code_primary: string;
  company_code_secondary: string;
  inventory_sku_id: string;
  zap_ean: string;
  universal_ean: string;
  warehouse_quantity: number | null;
};

export function enrichOutboundReportRow(
  row: Record<string, unknown>,
  lookups: OutboundSkuLookups
): EnrichedOutboundReportRow {
  const skuFields = resolveOutboundLineItemProductSkuFields(
    row,
    lookups.eanBySkuKey,
    lookups.listingSkuByKey
  );
  const company_code_primary = resolveOutboundCompanyCodePrimary(row, lookups);

  const keys = mappingSkuKeysFromRow(row);
  let hit: ZapEanLookup | undefined;
  for (const k of keys) {
    hit = lookups.eanBySkuKey.get(k);
    if (hit) break;
  }
  const companyPrimaryForEan = String(
    row.company_code_primary ?? row.po_secondary_sku ?? ""
  );

  return {
    master_sku: skuFields.master_sku,
    company_code_primary,
    company_code_secondary: strTrimSkuField(row.company_code_secondary),
    inventory_sku_id: skuFields.inventory_sku_id,
    zap_ean: resolveZapEanDisplay(companyPrimaryForEan, hit),
    universal_ean: hit?.universal_ean ?? "",
    warehouse_quantity: resolveWarehouseQuantityFromLookups(row, lookups),
  };
}

export async function loadOutboundSkuLookups(
  rows: Record<string, unknown>[],
  companyId: number | null | undefined
): Promise<OutboundSkuLookups> {
  const resolvedCompanyId =
    companyId != null && Number.isFinite(companyId) && companyId > 0
      ? companyId
      : null;

  const secondarySkus = [
    ...new Set(
      rows.map((r) => strTrimSkuField(r.po_secondary_sku)).filter(Boolean)
    ),
  ];

  const companyCodeBySecondarySku = new Map<string, string>();
  if (resolvedCompanyId != null && secondarySkus.length > 0) {
    const coR = await query(
      `SELECT secondary_sku, company_code_primary
         FROM company_secondary_sku
        WHERE company_id = $1
          AND secondary_sku = ANY($2::varchar[])`,
      [resolvedCompanyId, secondarySkus]
    );
    for (const row of coR.rows as {
      secondary_sku: string;
      company_code_primary: string | null;
    }[]) {
      const sku = strTrimSkuField(row.secondary_sku);
      const code = strTrimSkuField(row.company_code_primary);
      if (sku && code) companyCodeBySecondarySku.set(sku, code);
    }
  }

  const lookupKeys = [...new Set(rows.flatMap((r) => outboundSkuLookupKeys(r)))];

  const eanBySkuKey =
    resolvedCompanyId != null && lookupKeys.length > 0
      ? await batchGetZapEanByCompany({
          company_id: resolvedCompanyId,
          sku_codes: lookupKeys,
        })
      : new Map<string, ZapEanLookup>();

  const listingQueryKeys = new Set(lookupKeys);
  for (const hit of eanBySkuKey.values()) {
    const code = hit.sku_code?.trim();
    if (code) listingQueryKeys.add(code);
  }

  const listingSkuByKey = await batchListingSkuByKeys([...listingQueryKeys]);
  seedListingSkuFromEanMappings(eanBySkuKey, listingSkuByKey);

  const partialLookups: Pick<OutboundSkuLookups, "listingSkuByKey" | "eanBySkuKey"> =
    { listingSkuByKey, eanBySkuKey };

  const skuIds = collectBinSkuIdsForRows(rows, partialLookups);

  const binStockBySkuId = new Map<string, number>();
  if (skuIds.length > 0) {
    const binR = await query(
      `SELECT b.sku_id, COALESCE(SUM(b.available_quantity), 0)::int AS qty
         FROM bins b
        WHERE b.is_deleted = false
          AND b.sku_id = ANY($1::varchar[])
        GROUP BY b.sku_id`,
      [skuIds]
    );
    for (const row of binR.rows as { sku_id: string; qty: number }[]) {
      const sku = strTrimSkuField(row.sku_id);
      if (sku) binStockBySkuId.set(sku, Number(row.qty) || 0);
    }
  }

  return {
    companyId: resolvedCompanyId,
    companyCodeBySecondarySku,
    eanBySkuKey,
    listingSkuByKey,
    binStockBySkuId,
  };
}

/** Company code for pendency PDF when row has no explicit marketplace code. */
export function resolvePendencyCompanyCodeFromEan(
  poSecondarySku: string,
  hit: ZapEanLookup | undefined
): string {
  if (!hit) return "";
  const po = poSecondarySku.trim();
  const channel = hit.channel_ean.trim();
  const universal = hit.universal_ean.trim();
  if (hit.ean_type === "ean" && channel) return channel;
  if (channel && channel !== po) return channel;
  if (universal) return universal;
  return "";
}

/** Normalize company name for fuzzy matching against `companies.name`. */
export function normalizeCompanyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Treat 0, empty, and whitespace as missing EAN values. */
export function isValidEanValue(v: unknown): boolean {
  if (v == null) return false;
  const s = String(v).trim();
  if (!s || s === "0") return false;
  return true;
}

export function eanValueToString(v: unknown): string {
  if (!isValidEanValue(v)) return "";
  return String(v).trim();
}

/** @deprecated Use mappingSkuKeysFromRow — po_secondary_sku matches company_code_primary, not dump SKU Code. */
export function skuKeysFromRow(row: Record<string, unknown>): string[] {
  return mappingSkuKeysFromRow(row);
}

export async function batchGetZapEanByCompany(opts: {
  company_id: number | null | undefined;
  sku_codes: string[];
}): Promise<Map<string, ZapEanLookup>> {
  const map = new Map<string, ZapEanLookup>();
  const companyId = opts.company_id;
  if (companyId == null || !Number.isFinite(companyId) || companyId < 1) {
    return map;
  }
  const codes = [...new Set(opts.sku_codes.map((c) => String(c).trim()).filter(Boolean))];
  if (codes.length === 0) return map;

  const r = await query(
    `SELECT sku_code, zap_ean, universal_ean, ean_type
       FROM company_ean_mappings
      WHERE company_id = $1
        AND (
          sku_code = ANY($2::text[])
          OR zap_ean = ANY($2::text[])
          OR universal_ean = ANY($2::text[])
        )`,
    [companyId, codes]
  );
  for (const row of r.rows) {
    const hit: ZapEanLookup = {
      sku_code: row.sku_code != null ? String(row.sku_code).trim() : "",
      channel_ean: row.zap_ean != null ? String(row.zap_ean) : "",
      universal_ean: row.universal_ean != null ? String(row.universal_ean) : "",
      ean_type: row.ean_type != null ? String(row.ean_type) : "",
    };
    const sku = String(row.sku_code).trim();
    if (sku) map.set(sku, hit);
    const channel = hit.channel_ean.trim();
    if (channel) map.set(channel, hit);
    const universal = hit.universal_ean.trim();
    if (universal) map.set(universal, hit);
  }
  return map;
}

/** Merge zap_ean + product SKU fields onto each outbound line item row. */
export function mergeZapEanIntoRows(
  rows: Record<string, unknown>[],
  lookup: Map<string, ZapEanLookup>,
  listingSkuByKey: Map<string, ListingSkuFields> = new Map()
): Record<string, unknown>[] {
  return rows.map((row) => {
    const keys = mappingSkuKeysFromRow(row);
    let hit: ZapEanLookup | undefined;
    for (const k of keys) {
      hit = lookup.get(k);
      if (hit) break;
    }
    const skuFields = resolveOutboundLineItemProductSkuFields(
      row,
      lookup,
      listingSkuByKey
    );
    const companyPrimaryForEan = String(
      row.company_code_primary ?? row.po_secondary_sku ?? ""
    );
    return {
      ...row,
      master_sku: skuFields.master_sku || row.master_sku,
      company_code_primary:
        skuFields.company_code_primary || row.company_code_primary,
      inventory_sku_id: skuFields.inventory_sku_id || row.inventory_sku_id,
      zap_ean: resolveZapEanDisplay(companyPrimaryForEan, hit),
      universal_ean: hit?.universal_ean ?? "",
      channel_ean: hit?.channel_ean ?? "",
    };
  });
}

export async function enrichRowsWithZapEan(
  rows: Record<string, unknown>[],
  companyId: number | null | undefined
): Promise<Record<string, unknown>[]> {
  const allKeys = rows.flatMap((r) => outboundSkuLookupKeys(r));
  const lookup = await batchGetZapEanByCompany({
    company_id: companyId,
    sku_codes: allKeys,
  });
  const listingQueryKeys = new Set(allKeys);
  for (const hit of lookup.values()) {
    const code = hit.sku_code?.trim();
    if (code) listingQueryKeys.add(code);
  }
  const listingSkuByKey = await batchListingSkuByKeys([...listingQueryKeys]);
  return mergeZapEanIntoRows(rows, lookup, listingSkuByKey);
}

/** Enrich listings_snapshot envelope `{ content: [...] }` in place. */
export async function enrichListingsSnapshotWithZapEan(
  snapshot: unknown,
  companyId: number | null | undefined
): Promise<unknown> {
  if (snapshot == null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    if (Array.isArray(snapshot)) {
      return enrichRowsWithZapEan(snapshot as Record<string, unknown>[], companyId);
    }
    return snapshot;
  }
  const o = snapshot as Record<string, unknown>;
  const content = o.content;
  if (!Array.isArray(content)) return snapshot;
  const enriched = await enrichRowsWithZapEan(
    content.filter((x): x is Record<string, unknown> => x != null && typeof x === "object"),
    companyId
  );
  return { ...o, content: enriched };
}

export async function listCompaniesWithMappings(): Promise<
  { id: number; name: string | null }[]
> {
  const r = await query(
    `SELECT DISTINCT c.id, c.name
       FROM companies c
       INNER JOIN company_ean_mappings m ON m.company_id = c.id
      ORDER BY c.name ASC NULLS LAST, c.id ASC`
  );
  return r.rows.map((row) => ({
    id: Number(row.id),
    name: row.name != null ? String(row.name) : null,
  }));
}

export async function listEanMappingsPaginated(opts: {
  page: number;
  limit: number;
  companyId?: number;
  search?: string;
}): Promise<{
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: EanMappingRow[];
}> {
  const { page, limit } = opts;
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (opts.companyId != null && Number.isFinite(opts.companyId) && opts.companyId > 0) {
    conditions.push(`m.company_id = $${p}`);
    params.push(opts.companyId);
    p += 1;
  }

  const search = typeof opts.search === "string" ? opts.search.trim() : "";
  if (search) {
    const q = `%${search.toLowerCase()}%`;
    conditions.push(
      `(LOWER(m.sku_code) LIKE $${p}
        OR LOWER(COALESCE(m.zap_ean, '')) LIKE $${p}
        OR LOWER(COALESCE(m.universal_ean, '')) LIKE $${p}
        OR LOWER(COALESCE(c.name, '')) LIKE $${p})`
    );
    params.push(q);
    p += 1;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countR = await query(
    `SELECT COUNT(*)::int AS n
       FROM company_ean_mappings m
       LEFT JOIN companies c ON c.id = m.company_id
       ${where}`,
    params
  );
  const total = Number(countR.rows[0]?.n) || 0;

  const listR = await query(
    `SELECT m.id, m.sku_code, m.company_id, c.name AS company_name,
            m.zap_ean, m.ean_type, m.universal_ean, m.created_at, m.updated_at
       FROM company_ean_mappings m
       LEFT JOIN companies c ON c.id = m.company_id
       ${where}
       ORDER BY m.sku_code ASC, c.name ASC NULLS LAST
       LIMIT $${p} OFFSET $${p + 1}`,
    [...params, limit, offset]
  );

  const content: EanMappingRow[] = listR.rows.map((row) => ({
    id: Number(row.id),
    sku_code: String(row.sku_code),
    company_id: Number(row.company_id),
    company_name: row.company_name != null ? String(row.company_name) : null,
    zap_ean: row.zap_ean != null ? String(row.zap_ean) : null,
    ean_type: row.ean_type != null ? String(row.ean_type) : null,
    universal_ean: row.universal_ean != null ? String(row.universal_ean) : null,
    created_at: new Date(row.created_at as string).toISOString(),
    updated_at: new Date(row.updated_at as string).toISOString(),
  }));

  return {
    total,
    current_page: page,
    per_page_count: limit,
    curr_page_count: content.length,
    content,
  };
}

export async function upsertEanMappings(
  rows: {
    sku_code: string;
    company_id: number;
    zap_ean: string | null;
    ean_type: string;
    universal_ean: string | null;
  }[]
): Promise<{ upserted: number; skipped: number }> {
  let upserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const sku = String(row.sku_code).trim();
    if (!sku || !Number.isFinite(row.company_id) || row.company_id < 1) {
      skipped += 1;
      continue;
    }
    const zap = row.zap_ean?.trim() || null;
    const universal = row.universal_ean?.trim() || null;
    if (!zap && !universal) {
      skipped += 1;
      continue;
    }
    await query(
      `INSERT INTO company_ean_mappings (sku_code, company_id, zap_ean, ean_type, universal_ean, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (sku_code, company_id) DO UPDATE SET
         zap_ean = EXCLUDED.zap_ean,
         ean_type = EXCLUDED.ean_type,
         universal_ean = COALESCE(EXCLUDED.universal_ean, company_ean_mappings.universal_ean),
         updated_at = NOW()`,
      [sku, row.company_id, zap, row.ean_type, universal]
    );
    upserted += 1;
  }
  return { upserted, skipped };
}

export type EanColumnConfig = {
  company_id: number;
  column_key: string;
  label: string;
};

export type EanMatrixRow = {
  sku_code: string;
  universal_ean: string | null;
  by_column: Record<string, string | null>;
};

const MATRIX_SORT_SKU = "sku_code";
const MATRIX_SORT_UNIVERSAL = "universal_ean";

/** Validate matrix sort column; returns null for default (sku_code asc). */
export function parseMatrixSortColumn(
  sort: string | undefined,
  columns: EanColumnConfig[]
): { kind: "sku" } | { kind: "universal" } | { kind: "column"; column_key: string; company_id: number } | null {
  const s = typeof sort === "string" ? sort.trim() : "";
  if (!s || s === MATRIX_SORT_SKU) return { kind: "sku" };
  if (s === MATRIX_SORT_UNIVERSAL) return { kind: "universal" };
  const col = columns.find((c) => c.column_key === s);
  if (col) return { kind: "column", column_key: col.column_key, company_id: col.company_id };
  return null;
}

/** Pivot flat mapping rows into wide matrix rows (one row per SKU). */
export function pivotMappingsToMatrixRows(
  skuCodes: string[],
  mappings: {
    sku_code: string;
    company_id: number;
    zap_ean: string | null;
    universal_ean: string | null;
  }[],
  companyIdToColumnKey: Map<number, string>
): EanMatrixRow[] {
  const bySku = new Map<
    string,
    { universal_ean: string | null; by_column: Record<string, string | null> }
  >();

  for (const sku of skuCodes) {
    bySku.set(sku, { universal_ean: null, by_column: {} });
  }

  for (const m of mappings) {
    const sku = String(m.sku_code);
    let entry = bySku.get(sku);
    if (!entry) {
      entry = { universal_ean: null, by_column: {} };
      bySku.set(sku, entry);
    }
    const u = m.universal_ean?.trim();
    if (u && !entry.universal_ean) entry.universal_ean = u;
    const columnKey = companyIdToColumnKey.get(m.company_id);
    if (columnKey) {
      const zap = m.zap_ean?.trim();
      entry.by_column[columnKey] = zap || null;
    }
  }

  return skuCodes.map((sku_code) => {
    const entry = bySku.get(sku_code) ?? { universal_ean: null, by_column: {} };
    return {
      sku_code,
      universal_ean: entry.universal_ean,
      by_column: entry.by_column,
    };
  });
}

export async function listEanColumnConfig(): Promise<EanColumnConfig[]> {
  const r = await query(
    `SELECT cfg.company_id, cfg.column_key, cfg.label
       FROM company_ean_column_config cfg
       INNER JOIN companies c ON c.id = cfg.company_id
      ORDER BY cfg.label ASC NULLS LAST, cfg.company_id ASC`
  );
  if (r.rows.length > 0) {
    return r.rows.map((row) => ({
      company_id: Number(row.company_id),
      column_key: String(row.column_key),
      label: String(row.label),
    }));
  }
  const fallback = await query(
    `SELECT DISTINCT m.company_id,
            ('company_' || m.company_id::text) AS column_key,
            COALESCE(c.name, 'Company ' || m.company_id::text) AS label
       FROM company_ean_mappings m
       LEFT JOIN companies c ON c.id = m.company_id
      ORDER BY label ASC NULLS LAST, m.company_id ASC`
  );
  return fallback.rows.map((row) => ({
    company_id: Number(row.company_id),
    column_key: String(row.column_key),
    label: String(row.label),
  }));
}

export async function listEanMappingsMatrixPaginated(opts: {
  page: number;
  limit: number;
  companyId?: number;
  search?: string;
  sort?: string;
  sortDir?: "asc" | "desc";
}): Promise<{
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  columns: EanColumnConfig[];
  content: EanMatrixRow[];
  summary: { total_mappings: number; sku_count: number };
}> {
  const { page, limit } = opts;
  const offset = (page - 1) * limit;
  const columns = await listEanColumnConfig();
  const companyIdToColumnKey = new Map(columns.map((c) => [c.company_id, c.column_key]));

  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (opts.companyId != null && Number.isFinite(opts.companyId) && opts.companyId > 0) {
    conditions.push(
      `m.sku_code IN (SELECT sku_code FROM company_ean_mappings WHERE company_id = $${p})`
    );
    params.push(opts.companyId);
    p += 1;
  }

  const search = typeof opts.search === "string" ? opts.search.trim() : "";
  if (search) {
    const q = `%${search.toLowerCase()}%`;
    conditions.push(
      `m.sku_code IN (
         SELECT DISTINCT sku_code FROM company_ean_mappings
          WHERE LOWER(sku_code) LIKE $${p}
             OR LOWER(COALESCE(universal_ean, '')) LIKE $${p}
             OR LOWER(COALESCE(zap_ean, '')) LIKE $${p}
       )`
    );
    params.push(q);
    p += 1;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countR = await query(
    `SELECT COUNT(DISTINCT m.sku_code)::int AS n
       FROM company_ean_mappings m
       ${where}`,
    params
  );
  const total = Number(countR.rows[0]?.n) || 0;

  const sortParsed = parseMatrixSortColumn(opts.sort, columns);
  const dir = opts.sortDir === "desc" ? "DESC" : "ASC";
  const nulls = opts.sortDir === "desc" ? "NULLS FIRST" : "NULLS LAST";

  const orderClause =
    sortParsed?.kind === "universal"
      ? `ORDER BY universal_ean ${dir} ${nulls}, sku_code ASC`
      : sortParsed?.kind === "column"
        ? `ORDER BY col_sort ${dir} ${nulls}, sku_code ASC`
        : `ORDER BY sku_code ${dir}`;

  const sortJoin =
    sortParsed?.kind === "column"
      ? `LEFT JOIN company_ean_mappings msort
           ON msort.sku_code = agg.sku_code AND msort.company_id = ${sortParsed.company_id}`
      : "";
  const colSortSelect =
    sortParsed?.kind === "column" ? ", MAX(msort.zap_ean) AS col_sort" : "";

  const skuR = await query(
    `WITH agg AS (
       SELECT m.sku_code,
              MAX(NULLIF(TRIM(m.universal_ean), '')) AS universal_ean
         FROM company_ean_mappings m
         ${where}
        GROUP BY m.sku_code
     )
     SELECT agg.sku_code, agg.universal_ean${colSortSelect}
       FROM agg
       ${sortJoin}
      ${orderClause}
      LIMIT $${p} OFFSET $${p + 1}`,
    [...params, limit, offset]
  );

  const skuCodes = skuR.rows.map((row) => String(row.sku_code));
  if (skuCodes.length === 0) {
    const summary = await countEanMappingsSummary(
      opts.companyId != null && opts.companyId > 0
        ? { companyId: opts.companyId }
        : undefined
    );
    return {
      total,
      current_page: page,
      per_page_count: limit,
      curr_page_count: 0,
      columns,
      content: [],
      summary,
    };
  }

  const mapR = await query(
    `SELECT m.sku_code, m.company_id, m.zap_ean, m.universal_ean
       FROM company_ean_mappings m
      WHERE m.sku_code = ANY($1::text[])`,
    [skuCodes]
  );

  const content = pivotMappingsToMatrixRows(
    skuCodes,
    mapR.rows.map((row) => ({
      sku_code: String(row.sku_code),
      company_id: Number(row.company_id),
      zap_ean: row.zap_ean != null ? String(row.zap_ean) : null,
      universal_ean: row.universal_ean != null ? String(row.universal_ean) : null,
    })),
    companyIdToColumnKey
  );

  const summary = await countEanMappingsSummary(
    opts.companyId != null && opts.companyId > 0
      ? { companyId: opts.companyId }
      : undefined
  );

  return {
    total,
    current_page: page,
    per_page_count: limit,
    curr_page_count: content.length,
    columns,
    content,
    summary,
  };
}

export async function countEanMappingsSummary(opts?: {
  companyId?: number;
}): Promise<{ total_mappings: number; sku_count: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (opts?.companyId != null && opts.companyId > 0) {
    conditions.push(`company_id = $1`);
    params.push(opts.companyId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const r = await query(
    `SELECT COUNT(*)::int AS total_mappings,
            COUNT(DISTINCT sku_code)::int AS sku_count
       FROM company_ean_mappings ${where}`,
    params
  );
  return {
    total_mappings: Number(r.rows[0]?.total_mappings) || 0,
    sku_count: Number(r.rows[0]?.sku_count) || 0,
  };
}
