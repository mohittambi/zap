export const SKU_ID_RE = /^[A-Za-z0-9._-]{1,100}$/;

export const SKU_TYPES = ["SINGLE", "PACK", "COMBO"] as const;
export type SkuType = (typeof SKU_TYPES)[number];

export const INVENTORY_BYPASS_VALUES = ["YES", "NO"] as const;
export type InventoryBypass = (typeof INVENTORY_BYPASS_VALUES)[number];

export interface CreateListingInput {
  sku_id: string;
  description: string;
  category?: string | null;
  sku_type?: SkuType;
  ops_tag?: string | null;
  inventory_bypass_on?: InventoryBypass;
  bulk_price?: number | null;
  actual_weight?: number | null;
  dimension?: string | null;
  no_of_constituents?: number;
  material_info?: string | null;
  keyword_pool?: string | null;
  img_hd?: string | null;
  img_white?: string | null;
  img_wdim?: string | null;
  img_link1?: string | null;
  img_link2?: string | null;
}

export class ListingCreateError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "ListingCreateError";
    this.statusCode = statusCode;
  }
}

function trimOrNull(value: unknown, maxLen: number): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, maxLen);
}

function parseOptionalNonNegativeNumber(
  value: unknown,
  field: string
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) {
    throw new ListingCreateError(`${field} must be a non-negative number`);
  }
  return n;
}

function parseOptionalPositiveInt(
  value: unknown,
  field: string
): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (Number.isNaN(n) || n < 1 || !Number.isInteger(n)) {
    throw new ListingCreateError(`${field} must be a positive integer`);
  }
  return n;
}

function parseOptionalUrl(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new ListingCreateError(`${field} must be an http(s) URL`);
    }
    return s;
  } catch {
    throw new ListingCreateError(`${field} must be a valid URL`);
  }
}

export function validateCreateListingInput(raw: Record<string, unknown>): CreateListingInput {
  const skuRaw = raw.sku_id;
  if (typeof skuRaw !== "string" && typeof skuRaw !== "number") {
    throw new ListingCreateError("sku_id is required");
  }
  const sku_id = String(skuRaw).trim();
  if (!sku_id) {
    throw new ListingCreateError("sku_id is required");
  }
  if (!SKU_ID_RE.test(sku_id)) {
    throw new ListingCreateError(
      "sku_id must be 1–100 characters and contain only letters, numbers, dots, underscores, or hyphens"
    );
  }

  const descRaw = raw.description;
  if (typeof descRaw !== "string" || !descRaw.trim()) {
    throw new ListingCreateError("description is required");
  }
  const description = descRaw.trim();
  if (description.length > 500) {
    throw new ListingCreateError("description must be at most 500 characters");
  }

  let sku_type: SkuType | undefined;
  if (raw.sku_type !== undefined && raw.sku_type !== null && raw.sku_type !== "") {
    const st = String(raw.sku_type).trim().toUpperCase();
    if (!SKU_TYPES.includes(st as SkuType)) {
      throw new ListingCreateError(`sku_type must be one of: ${SKU_TYPES.join(", ")}`);
    }
    sku_type = st as SkuType;
  }

  let inventory_bypass_on: InventoryBypass | undefined;
  if (
    raw.inventory_bypass_on !== undefined &&
    raw.inventory_bypass_on !== null &&
    raw.inventory_bypass_on !== ""
  ) {
    const inv = String(raw.inventory_bypass_on).trim().toUpperCase();
    if (!INVENTORY_BYPASS_VALUES.includes(inv as InventoryBypass)) {
      throw new ListingCreateError("inventory_bypass_on must be YES or NO");
    }
    inventory_bypass_on = inv as InventoryBypass;
  }

  const bulk_price = parseOptionalNonNegativeNumber(raw.bulk_price, "bulk_price");
  const actual_weight = parseOptionalNonNegativeNumber(raw.actual_weight, "actual_weight");
  const no_of_constituents = parseOptionalPositiveInt(
    raw.no_of_constituents,
    "no_of_constituents"
  );
  const img_hd = parseOptionalUrl(raw.img_hd, "img_hd");
  const img_white = parseOptionalUrl(raw.img_white, "img_white");
  const img_wdim = parseOptionalUrl(raw.img_wdim, "img_wdim");
  const img_link1 = parseOptionalUrl(raw.img_link1, "img_link1");
  const img_link2 = parseOptionalUrl(raw.img_link2, "img_link2");

  return {
    sku_id,
    description,
    category: trimOrNull(raw.category, 200),
    sku_type,
    ops_tag: trimOrNull(raw.ops_tag, 50),
    inventory_bypass_on,
    bulk_price,
    actual_weight,
    dimension: trimOrNull(raw.dimension, 200),
    no_of_constituents,
    material_info: trimOrNull(raw.material_info, 500),
    keyword_pool: trimOrNull(raw.keyword_pool, 500),
    img_hd,
    img_white,
    img_wdim,
    img_link1,
    img_link2,
  };
}

export function buildCreateListingDefaults(input: CreateListingInput) {
  return {
    master_sku: input.sku_id,
    inventory_sku_id: input.sku_id,
    pack_combo_sku_id: "NA",
    sku_type: input.sku_type ?? "SINGLE",
    inventory_bypass_on: input.inventory_bypass_on ?? "NO",
    no_of_constituents: input.no_of_constituents ?? 1,
    available_quantity: 0,
    source: "zap" as const,
  };
}

/** Map spreadsheet row (snake_case or legacy headers) to createListing body fields. */
export function mapBulkRowToCreateListingInput(
  row: Record<string, unknown>
): Record<string, unknown> {
  return {
    sku_id:
      row.sku_id ??
      row["SKU ID"] ??
      row.SKU_ID ??
      row.sku ??
      row.SKU,
    description:
      row.description ??
      row.Description ??
      row.title ??
      row.Title,
    category: row.category ?? row.Category,
    sku_type: row.sku_type ?? row["SKU Type"],
    inventory_bypass_on:
      row.inventory_bypass_on ??
      row["Inventory Bypass"] ??
      row.inventory_bypass,
    ops_tag: row.ops_tag ?? row["Ops Tag"],
    bulk_price: row.bulk_price ?? row["Bulk Price"],
    actual_weight: row.actual_weight ?? row["Actual Weight"],
    dimension: row.dimension ?? row.Dimension,
    no_of_constituents:
      row.no_of_constituents ??
      row["No of Constituents"] ??
      row.constituents,
    material_info: row.material_info ?? row["Material Info"],
    keyword_pool: row.keyword_pool ?? row["Keyword Pool"],
    img_hd: row.img_hd ?? row["Img HD"] ?? row.img_hd_url,
    img_white: row.img_white ?? row["Img White"],
    img_wdim: row.img_wdim ?? row["Img Wdim"],
    img_link1: row.img_link1 ?? row["Img Link1"],
    img_link2: row.img_link2 ?? row["Img Link2"],
  };
}

export function isBulkRowEmpty(row: Record<string, unknown>): boolean {
  const mapped = mapBulkRowToCreateListingInput(row);
  const sku = mapped.sku_id;
  const desc = mapped.description;
  const skuEmpty =
    sku == null || (typeof sku === "string" && !sku.trim()) || sku === "";
  const descEmpty =
    desc == null || (typeof desc === "string" && !desc.trim()) || desc === "";
  return skuEmpty && descEmpty;
}
