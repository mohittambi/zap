import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET_OUTBOUND =
  process.env.ZAP_STORAGE_BUCKET_OUTBOUND ?? "outbound-po-files";
const BUCKET_INBOUND =
  process.env.ZAP_STORAGE_BUCKET_INBOUND ?? "inbound-grn-files";

export function isZapStorageConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

export function getOutboundBucket(): string {
  return BUCKET_OUTBOUND;
}

export function getInboundBucket(): string {
  return BUCKET_INBOUND;
}

let _admin: SupabaseClient | null | undefined;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (_admin !== undefined) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    _admin = null;
    return _admin;
  }
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

export async function uploadBufferToBucket(
  bucket: string,
  objectPath: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("Zap Storage is not configured");
  }
  const { error } = await admin.storage
    .from(bucket)
    .upload(objectPath, body, {
      contentType,
      upsert: true,
    });
  if (error) throw new Error(error.message);
}

export async function createSignedDownloadUrl(
  bucket: string,
  objectPath: string,
  expiresSec = 3600
): Promise<string> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("Zap Storage is not configured");
  }
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(objectPath, expiresSec);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Could not create signed URL");
  }
  return data.signedUrl;
}

export async function downloadBufferFromBucket(
  bucket: string,
  objectPath: string
): Promise<{ buffer: Buffer; contentType: string | null }> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("Zap Storage is not configured");
  }
  const { data, error } = await admin.storage.from(bucket).download(objectPath);
  if (error || !data) {
    throw new Error(error?.message ?? "Download failed");
  }
  const ab = await data.arrayBuffer();
  return {
    buffer: Buffer.from(ab),
    contentType: data.type || null,
  };
}
