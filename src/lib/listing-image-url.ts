/** Image field names on eAutomate listing rows and warehouse `listings` table. */
export const LISTING_IMAGE_FIELDS = [
  "thumb_img_url",
  "thumbnail_url",
  "product_image",
  "image_url",
  "img_hd",
  "img_white",
  "img_wdim",
  "img_link1",
  "img_link2",
  "image",
  "sku_image",
  "hd_image_url",
] as const;

function isDisplayableImageUrl(raw: string): boolean {
  const u = raw.trim();
  if (!u) return false;
  return (
    u.startsWith("http://") ||
    u.startsWith("https://") ||
    u.startsWith("//")
  );
}

export function normalizeDisplayImageUrl(url: string): string {
  const t = url.trim();
  if (t.startsWith("//")) return `https:${t}`;
  return t;
}

/** First usable image URL on a flat listing / line-item record. */
export function pickImageFromRecord(
  rec: Record<string, unknown> | null | undefined
): string | null {
  if (!rec) return null;
  for (const k of LISTING_IMAGE_FIELDS) {
    const raw = rec[k];
    if (raw == null || raw === "") continue;
    const u = String(raw).trim();
    if (isDisplayableImageUrl(u)) return normalizeDisplayImageUrl(u);
  }
  return null;
}

function listingOf(row: Record<string, unknown>): Record<string, unknown> | null {
  const l = row.listing;
  if (l && typeof l === "object" && !Array.isArray(l)) {
    return l as Record<string, unknown>;
  }
  return null;
}

/** Root row first, then nested `listing` (same order as inbound SKU-wise). */
export function pickListingImageFromRow(row: Record<string, unknown>): string | null {
  const root = pickImageFromRecord(row);
  if (root) return root;
  return pickImageFromRecord(listingOf(row));
}

/** All candidate URLs for `<img onError>` fallbacks (root, then listing). */
export function listingImageCandidatesFromRow(
  row: Record<string, unknown>
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (rec: Record<string, unknown> | null | undefined) => {
    if (!rec) return;
    for (const k of LISTING_IMAGE_FIELDS) {
      const raw = rec[k];
      if (raw == null || raw === "") continue;
      const u = String(raw).trim();
      if (!isDisplayableImageUrl(u)) continue;
      const norm = normalizeDisplayImageUrl(u);
      if (!seen.has(norm)) {
        seen.add(norm);
        out.push(norm);
      }
    }
  };
  add(row);
  add(listingOf(row));
  return out;
}
