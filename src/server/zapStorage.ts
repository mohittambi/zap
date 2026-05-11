const BUCKET_OUTBOUND =
  process.env.ZAP_STORAGE_BUCKET_OUTBOUND ?? "outbound-po-files";
const BUCKET_INBOUND =
  process.env.ZAP_STORAGE_BUCKET_INBOUND ?? "inbound-grn-files";

function storageBase(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  return `${url}/storage/v1`;
}

function storageHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
  };
}

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

export async function uploadBufferToBucket(
  bucket: string,
  objectPath: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const url = `${storageBase()}/object/${bucket}/${objectPath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...storageHeaders(),
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    let msg = `Storage upload failed (${res.status})`;
    try {
      const j = await res.json() as { message?: string; error?: string; msg?: string };
      msg = j.message ?? j.error ?? j.msg ?? msg;
    } catch { /* keep default */ }
    throw new Error(msg);
  }
}

export async function createSignedDownloadUrl(
  bucket: string,
  objectPath: string,
  expiresSec = 3600
): Promise<string> {
  const url = `${storageBase()}/object/sign/${bucket}/${objectPath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { ...storageHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: expiresSec }),
  });
  if (!res.ok) {
    let msg = `Could not create signed URL (${res.status})`;
    try {
      const j = await res.json() as { message?: string; error?: string };
      msg = j.message ?? j.error ?? msg;
    } catch { /* keep default */ }
    throw new Error(msg);
  }
  const data = await res.json() as { signedURL?: string; signedUrl?: string };
  const signed = data.signedURL ?? data.signedUrl;
  if (!signed) throw new Error("No signed URL in response");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  return signed.startsWith("http") ? signed : `${base}${signed}`;
}

export async function downloadBufferFromBucket(
  bucket: string,
  objectPath: string
): Promise<{ buffer: Buffer; contentType: string | null }> {
  const url = `${storageBase()}/object/${bucket}/${objectPath}`;
  const res = await fetch(url, { headers: storageHeaders() });
  if (!res.ok) {
    let msg = `Download failed (${res.status})`;
    try {
      const j = await res.json() as { message?: string; error?: string };
      msg = j.message ?? j.error ?? msg;
    } catch { /* keep default */ }
    throw new Error(msg);
  }
  const ab = await res.arrayBuffer();
  return {
    buffer: Buffer.from(ab),
    contentType: res.headers.get("content-type"),
  };
}
