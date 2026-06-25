/**
 * Listing image mirror helpers for migration script and future sync (doctrine #14).
 * DORMANT until activation — do not call mirror from sync without explicit cutover.
 */

export const LISTING_IMAGE_FIELDS = [
  "img_hd",
  "img_white",
  "img_wdim",
  "img_link1",
  "img_link2",
];

/** DB column → storage basename */
export function slotToObjectBasename(field) {
  const map = {
    img_hd: "hd",
    img_white: "white",
    img_wdim: "wdim",
    img_link1: "alt1",
    img_link2: "alt2",
  };
  return map[field] ?? field.replace(/^img_/, "");
}

export function sanitizeStorageSegment(segment) {
  return String(segment ?? "")
    .trim()
    .replace(/[/\\]+/g, "_")
    .replace(/\.\./g, "_")
    .slice(0, 200);
}

export function buildPublicStorageUrl(supabaseBase, bucket, objectPath) {
  const base = String(supabaseBase ?? "").trim().replace(/\/$/, "");
  const path = String(objectPath ?? "").replace(/^\/+/, "");
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

export function isZapStoragePublicUrl(url, supabaseBase) {
  const u = String(url ?? "").trim();
  if (!u) return false;
  const base = String(supabaseBase ?? "").trim().replace(/\/$/, "");
  if (!base) return u.includes("/storage/v1/object/public/");
  return u.startsWith(`${base}/storage/v1/object/public/`);
}

/** True if URL should be mirrored (non-empty, not already Zap public URL). */
export function isExternalImageUrl(url, supabaseBase) {
  const u = String(url ?? "").trim();
  if (!u) return false;
  if (!/^https?:\/\//i.test(u) && !u.startsWith("//")) return false;
  return !isZapStoragePublicUrl(u, supabaseBase);
}

export function inferExtension(sourceUrl, contentType) {
  const ct = String(contentType ?? "").toLowerCase().split(";")[0].trim();
  if (ct === "image/jpeg" || ct === "image/jpg") return ".jpg";
  if (ct === "image/png") return ".png";
  if (ct === "image/webp") return ".webp";
  if (ct === "image/gif") return ".gif";
  const m = String(sourceUrl ?? "")
    .split("?")[0]
    .match(/\.(jpe?g|png|webp|gif)$/i);
  if (m) return `.${m[1].toLowerCase().replace("jpeg", "jpg")}`;
  return ".jpg";
}

export function listingImageObjectPath(skuId, field, ext) {
  const safeSku = sanitizeStorageSegment(skuId);
  const slot = slotToObjectBasename(field);
  const suffix = ext.startsWith(".") ? ext : `.${ext}`;
  return `${safeSku}/${slot}${suffix}`;
}

function storageBase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  return `${url.replace(/\/$/, "")}/storage/v1`;
}

function storageHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
  };
}

export function getListingsBucketName() {
  return process.env.ZAP_STORAGE_BUCKET_LISTINGS?.trim() || "listing-images";
}

export function isListingStorageConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function downloadImage(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const retries = opts.retries ?? 2;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const target = url.startsWith("//") ? `https:${url}` : url;
      const res = await fetch(target, {
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "follow",
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const ab = await res.arrayBuffer();
      const buffer = Buffer.from(ab);
      const contentType = res.headers.get("content-type") || "application/octet-stream";
      return { buffer, contentType, bytes: buffer.length, httpStatus: res.status };
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await sleep(500 * (attempt + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function uploadToListingsBucket(objectPath, buffer, contentType) {
  const bucket = getListingsBucketName();
  const url = `${storageBase()}/object/${bucket}/${objectPath.replace(/^\/+/, "")}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...storageHeaders(),
      "Content-Type": contentType || "application/octet-stream",
      "x-upsert": "true",
    },
    body: new Uint8Array(buffer),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    let msg = `Storage upload failed (${res.status})`;
    try {
      const j = await res.json();
      msg = j.message ?? j.error ?? j.msg ?? msg;
    } catch {
      /* keep default */
    }
    throw new Error(msg);
  }
  return { bucket, objectPath };
}

/**
 * Download from sourceUrl, upload to listing-images bucket, return public URL.
 * @throws on any failure (caller must not write CDN URL to DB)
 */
export async function mirrorListingImage({ skuId, field, sourceUrl }) {
  if (!isListingStorageConfigured()) {
    throw new Error(
      "Zap Storage not configured (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)"
    );
  }
  const downloaded = await downloadImage(sourceUrl);
  const ext = inferExtension(sourceUrl, downloaded.contentType);
  const objectPath = listingImageObjectPath(skuId, field, ext);
  const { bucket } = await uploadToListingsBucket(
    objectPath,
    downloaded.buffer,
    downloaded.contentType
  );
  const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const publicUrl = buildPublicStorageUrl(supabaseBase, bucket, objectPath);
  return {
    publicUrl,
    storagePath: objectPath,
    bytes: downloaded.bytes,
    httpStatus: downloaded.httpStatus,
    contentType: downloaded.contentType,
  };
}
