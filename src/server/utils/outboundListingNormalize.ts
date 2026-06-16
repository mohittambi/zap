export type OutboundListingNormalizeResult = {
  row: Record<string, unknown>;
  repaired: boolean;
  repairs: string[];
};

function numberFromUnknown(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function isNumericCommercialValue(v: unknown): boolean {
  if (v == null || v === "") return false;
  const s = String(v).trim();
  return /^-?\d+(\.\d+)?$/.test(s);
}

export function looksLikeGstPercent(v: unknown): boolean {
  const n = numberFromUnknown(v);
  return n != null && Number.isInteger(n) && n >= 0 && n <= 28;
}

function looksLikePrice(v: unknown, mrp?: unknown): boolean {
  const n = numberFromUnknown(v);
  if (n == null || n <= 0) return false;
  const mrpN = numberFromUnknown(mrp);
  if (n > 28) return true;
  if (mrpN != null && mrpN > 0 && n > mrpN) return true;
  return false;
}

function fixMissingInchQuoteInTitle(title: string): string {
  return title.replace(/\((\d+(?:\.\d+)?),\s*([A-Za-z])/g, '($1", $2');
}

function fragmentLooksLikeColor(fragment: string): boolean {
  const t = fragment.trim();
  if (!t || isNumericCommercialValue(t)) return false;
  return /[a-zA-Z]/.test(t);
}

function mergeTitleWithColorFragment(title: string, fragment: string): string {
  const base = title.trimEnd();
  const tail = fragment.trim();
  if (!tail) return base;
  if (base.endsWith('"')) {
    return `${base}${tail.startsWith(",") ? "" : ", "}${tail}`;
  }
  if (/\d\s*$/.test(base) && fragmentLooksLikeColor(tail)) {
    return `${base}", ${tail}`;
  }
  if (/[\("(][^)]*$/.test(base)) {
    if (fragmentLooksLikeColor(tail) && !base.endsWith(",")) {
      return `${base}, ${tail}`;
    }
    return `${base}${tail}`;
  }
  return `${base}, ${tail}`;
}

/** Extract color variant from a repaired product title when not already set. */
export function extractColorFromTitle(title: string): string | null {
  const t = title.trim();
  if (!t) return null;

  const patterns = [
    /,\s*([A-Za-z][A-Za-z0-9 &]+?)\s*\)\s*\(Box\)\s*$/i,
    /,\s*([A-Za-z][A-Za-z0-9 &]+?)\s*\)\s*$/i,
    /\(\s*([A-Za-z][A-Za-z0-9 &]+?)\s*\)\s*\(Box\)\s*$/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1]) {
      const color = m[1].trim();
      if (color.length > 1 && !/^\d/.test(color)) return color;
    }
  }
  return null;
}

function titleHasEmbeddedCommercialCsv(row: Record<string, unknown>): boolean {
  const title = String(row.title ?? "");
  if (!title.includes(",")) return false;
  if (row.rate_without_tax != null && isNumericCommercialValue(row.rate_without_tax)) {
    return false;
  }
  return /\)(?:\(Box\))?,\d/.test(title) || /,\d+\.?\d*,\d+,/.test(title);
}

/** Unpack commercial columns accidentally stored inside title (unquoted CSV). */
function unpackTitleEmbeddedCommercials(
  row: Record<string, unknown>
): Record<string, unknown> | null {
  const title = String(row.title ?? "");
  const match = title.match(
    /^(.+?\)(?:\(Box\))?),\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*$/
  );
  if (!match) return null;
  const [, pureTitle, rate, tax, qty, mrp, margin, total] = match;
  return {
    ...row,
    title: pureTitle,
    rate_without_tax: Number(rate),
    tax_rate: Number(tax),
    demand: Number(qty),
    original_demand: Number(qty),
    mrp: Number(mrp),
    margin: Number(margin),
    total_amount: Number(total),
  };
}

export function isMisalignedCommercialRow(row: Record<string, unknown>): boolean {
  if (titleHasEmbeddedCommercialCsv(row)) return true;
  const rateRaw = row.rate_without_tax;
  const rateText = rateRaw == null ? "" : String(rateRaw).trim();
  if (!rateText || isNumericCommercialValue(rateRaw)) return false;
  const shiftedRate = numberFromUnknown(row.tax_rate);
  return (
    shiftedRate != null &&
    looksLikePrice(shiftedRate, row.mrp) &&
    /[a-zA-Z]/.test(rateText)
  );
}

function looksLikeOrderQty(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 100_000;
}

const MRP_RELATIVE_TOLERANCE = 0.03;

function approxEqual(a: number, b: number, relTol = MRP_RELATIVE_TOLERANCE): boolean {
  if (b === 0) return Math.abs(a) < 0.01;
  return Math.abs(a - b) / Math.abs(b) <= relTol;
}

function inclusiveRateFromRow(row: Record<string, unknown>): number | null {
  const rate = numberFromUnknown(row.rate_without_tax);
  if (rate == null || rate <= 0) return null;
  const tax = numberFromUnknown(row.tax_rate);
  if (tax != null && looksLikeGstPercent(tax)) {
    return rate * (1 + tax / 100);
  }
  return null;
}

/** True when stored MRP matches landing/inclusive rate rather than retail MRP. */
export function mrpLooksLikeLandingRate(row: Record<string, unknown>): boolean {
  const mrp = numberFromUnknown(row.mrp);
  if (mrp == null || mrp <= 0) return false;

  const landing = numberFromUnknown(row.landing_rate);
  if (landing != null && landing > 0 && approxEqual(mrp, landing)) return true;

  const inclusive = inclusiveRateFromRow(row);
  if (inclusive != null && approxEqual(mrp, inclusive)) return true;

  const rate = numberFromUnknown(row.rate_without_tax);
  if (rate == null || rate <= 0) return false;
  for (const gst of [5, 12, 18, 28]) {
    if (approxEqual(mrp, rate * (1 + gst / 100))) return true;
  }
  return false;
}

/** Candidate value is plausibly retail MRP (not margin %, GST %, or inclusive rate). */
export function isPlausibleRetailMrp(
  candidate: unknown,
  row: Record<string, unknown>
): boolean {
  const mrp = numberFromUnknown(candidate);
  if (mrp == null || mrp <= 0) return false;

  const rate = numberFromUnknown(row.rate_without_tax);
  if (rate != null && rate > 0 && mrp <= rate * 1.02) return false;

  const candidateText = String(candidate).trim();
  if (
    rate != null &&
    rate > mrp &&
    mrp <= 100 &&
    candidateText.includes(".")
  ) {
    return false;
  }

  return !mrpLooksLikeLandingRate({ ...row, mrp: candidate });
}

function correctShiftedMrp(
  row: Record<string, unknown>,
  repairs: string[]
): Record<string, unknown> {
  const out = { ...row };
  if (!mrpLooksLikeLandingRate(out)) return out;

  const marginN = numberFromUnknown(out.margin);
  if (marginN != null && isPlausibleRetailMrp(marginN, out)) {
    out.mrp = marginN;
    repairs.push("mrp_restored_from_margin");
    return out;
  }

  repairs.push("mrp_marked_suspicious");
  return out;
}

function finalizeListingRow(
  row: Record<string, unknown>,
  repairs: string[],
  repaired: boolean
): OutboundListingNormalizeResult {
  const finalized = correctShiftedMrp(row, repairs);
  return {
    row: finalized,
    repaired: repaired || repairs.length > 0,
    repairs,
  };
}

function inferGstFromMrpAndRate(mrp: unknown, rate: unknown): number | null {
  const m = numberFromUnknown(mrp);
  const r = numberFromUnknown(rate);
  if (m == null || r == null || r <= 0 || m <= 0) return null;
  for (const gst of [5, 12, 18, 28]) {
    const landing = r * (1 + gst / 100);
    if (Math.abs(landing - m) / m <= 0.03) return gst;
  }
  return null;
}

/** Recover order quantity after column shift removed or conflated demand. */
function recoverShiftedDemand(
  row: Record<string, unknown>,
  gstPct: number | null,
  misaligned: boolean
): number | null {
  const marginN = numberFromUnknown(row.margin);
  if (
    marginN != null &&
    looksLikeOrderQty(marginN) &&
    !String(marginN).includes(".")
  ) {
    if (gstPct == null || marginN !== gstPct) return marginN;
  }

  const boxQ = numberFromUnknown(row.box_quantity);
  if (boxQ != null && looksLikeOrderQty(boxQ)) {
    if (gstPct == null || boxQ !== gstPct) return boxQ;
  }

  const rate = numberFromUnknown(row.rate_without_tax);
  const total = numberFromUnknown(row.total_amount);
  if (total != null && total > 0 && rate != null && rate > 0) {
    const taxMult = gstPct != null && gstPct > 0 ? 1 + gstPct / 100 : 1;
    const inferred = Math.round(total / (rate * taxMult));
    if (looksLikeOrderQty(inferred)) return inferred;
  }

  const landing = numberFromUnknown(row.landing_rate);
  if (total != null && total > 0 && landing != null && landing > 0) {
    const inferred = Math.round(total / landing);
    if (looksLikeOrderQty(inferred)) return inferred;
  }

  if (misaligned) {
    const wh = numberFromUnknown(row.warehouse_quantity);
    if (wh != null && looksLikeOrderQty(wh)) {
      if (gstPct == null || wh !== gstPct) return wh;
    }
  }

  return null;
}

/**
 * Repair listing rows where a comma inside the title (common with inch marks like 6.2")
 * shifted commercial columns (color in rate, rate in tax, GST in demand).
 */
export function normalizeOutboundListingRow(
  row: Record<string, unknown>
): OutboundListingNormalizeResult {
  const repairs: string[] = [];

  const unpacked = unpackTitleEmbeddedCommercials(row);
  if (unpacked) {
    const out = { ...unpacked };
    out.title = fixMissingInchQuoteInTitle(String(out.title ?? ""));
    const extracted = extractColorFromTitle(String(out.title ?? ""));
    if (extracted) {
      out.color = extracted;
      repairs.push("color_extracted");
    }
    repairs.push("title_unpacked");
    return finalizeListingRow(out, repairs, true);
  }

  if (!isMisalignedCommercialRow(row)) {
    const out = { ...row };
    if (!out.color && out.title) {
      const extracted = extractColorFromTitle(String(out.title));
      if (extracted) {
        out.color = extracted;
        repairs.push("color_extracted");
      }
    }
    out.title = fixMissingInchQuoteInTitle(String(out.title ?? ""));
    return finalizeListingRow(out, repairs, repairs.length > 0);
  }

  const rateText = String(row.rate_without_tax ?? "").trim();
  const out: Record<string, unknown> = { ...row };
  out.title = mergeTitleWithColorFragment(String(row.title ?? ""), rateText);
  repairs.push("title_merged");

  const shiftedRate = row.tax_rate;
  out.rate_without_tax = shiftedRate;
  delete out.tax_rate;
  repairs.push("rate_restored");

  const demandMaybeTax =
    numberFromUnknown(row.demand) ?? numberFromUnknown(row.original_demand);
  const preQty = recoverShiftedDemand(row, null, true);

  let gstPct: number | null = null;
  if (looksLikeGstPercent(demandMaybeTax)) {
    const ambiguousFive =
      demandMaybeTax === 5 &&
      (preQty == null || preQty === 5);
    const demandIsGst =
      !ambiguousFive &&
      (preQty == null ||
        preQty !== demandMaybeTax ||
        (demandMaybeTax as number) > 5);

    if (demandIsGst) {
      out.tax_rate = demandMaybeTax;
      gstPct = demandMaybeTax;
      delete out.demand;
      delete out.original_demand;
      repairs.push("tax_restored");
    }
  } else {
    delete out.tax_rate;
  }

  const recoveredQty = recoverShiftedDemand(out, gstPct, true) ?? preQty;
  if (recoveredQty != null) {
    out.demand = recoveredQty;
    out.original_demand = recoveredQty;
    repairs.push("demand_recovered");
  } else if (demandMaybeTax != null && !looksLikeGstPercent(demandMaybeTax)) {
    out.demand = demandMaybeTax;
    out.original_demand = demandMaybeTax;
  } else if (demandMaybeTax === 5 && gstPct == null) {
    out.demand = 5;
    out.original_demand = 5;
    const inferred = inferGstFromMrpAndRate(out.mrp, out.rate_without_tax);
    if (inferred != null) {
      out.tax_rate = inferred;
      gstPct = inferred;
      repairs.push("tax_inferred");
    }
  }

  if (gstPct == null) {
    const inferred = inferGstFromMrpAndRate(out.mrp, out.rate_without_tax);
    if (inferred != null) {
      out.tax_rate = inferred;
      repairs.push("tax_inferred");
    }
  }

  const extracted = extractColorFromTitle(String(out.title));
  if (extracted) {
    out.color = extracted;
    repairs.push("color_extracted");
  }
  out.title = fixMissingInchQuoteInTitle(String(out.title ?? ""));

  return finalizeListingRow(out, repairs, true);
}

/** @deprecated Use normalizeOutboundListingRow */
export function repairOutboundListingCommercialFields(
  row: Record<string, unknown>
): Record<string, unknown> {
  return normalizeOutboundListingRow(row).row;
}

export function normalizeOutboundListingRows(
  rows: Record<string, unknown>[]
): { rows: Record<string, unknown>[]; repairedCount: number; stillMisaligned: number } {
  let repairedCount = 0;
  let stillMisaligned = 0;
  const normalized = rows.map((row) => {
    const result = normalizeOutboundListingRow(row);
    if (result.repaired) repairedCount += 1;
    if (isMisalignedCommercialRow(result.row)) stillMisaligned += 1;
    return result.row;
  });
  return { rows: normalized, repairedCount, stillMisaligned };
}
