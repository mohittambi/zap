/**
 * Display labels for zap-source vs eAutomate-source ids.
 *
 * Doctrine #5: zap-source ids carry a prefix (`ZP-` / `ZG-`); eAutomate-source
 * ids render bare. The asymmetry is intentional — a prefix means "this exists
 * only in zap, you cannot find it in eAutomate".
 *
 * DB columns and URLs stay numeric. Prefix is display-only.
 */

const PO_PREFIX = "ZP-";
const GRN_PREFIX = "ZG-";

export type RecordSource = "zap" | "eautomate";
export type GrnDisplaySource = RecordSource | "draft";

function bareNumberString(id: number | string): string {
  if (typeof id === "number") return String(id);
  return id.trim();
}

export function formatPoLabel(
  poId: number | string | null | undefined,
  source: RecordSource | null | undefined
): string {
  if (poId == null || poId === "") return "—";
  const bare = bareNumberString(poId);
  return source === "zap" ? `${PO_PREFIX}${bare}` : bare;
}

export function formatGrnLabel(
  grnId: number | string | null | undefined,
  source: GrnDisplaySource | null | undefined
): string {
  if (grnId == null || grnId === "") return "—";
  let bare = bareNumberString(grnId);
  /** Legacy zap-created drafts used negative grn_ids. The migration backfills
   * source='zap' for those rows; either way, we strip the leading minus so the
   * label reads as a clean positive number after the ZG- prefix. */
  if ((source === "zap" || source === "draft") && bare.startsWith("-")) {
    bare = bare.slice(1);
  }
  return source === "zap" || source === "draft" ? `${GRN_PREFIX}${bare}` : bare;
}

/**
 * Strip a `ZP-` / `ZG-` prefix (case-insensitive) so a search input accepts
 * either the labelled or bare form. `"  ZP-16719  "` → `"16719"`.
 */
export function stripIdPrefix(input: string | null | undefined): string {
  if (input == null) return "";
  const trimmed = String(input).trim();
  const m = /^(?:zp-|zg-)(.+)$/i.exec(trimmed);
  return m ? m[1].trim() : trimmed;
}
