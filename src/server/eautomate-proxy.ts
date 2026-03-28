/**
 * Server-side calls to web.eautomate.in using EAUTOMATE_COOKIE / EAUTOMATE_BEARER_TOKEN.
 * Used by API routes that proxy eautomate (e.g. inbound lot listings).
 */

export function getEautomateBaseUrl(): string {
  return (process.env.EAUTOMATE_BASE_URL || "https://web.eautomate.in").replace(
    /\/$/,
    ""
  );
}

export function eautomateProxyHeaders(): Headers {
  const h = new Headers();
  h.set("Accept", "application/json");
  const token = process.env.EAUTOMATE_BEARER_TOKEN?.trim();
  if (token) h.set("Authorization", `Bearer ${token}`);
  const cookie = process.env.EAUTOMATE_COOKIE?.trim();
  if (cookie) h.set("Cookie", cookie);
  return h;
}

export function eautomateConfigured(): boolean {
  return Boolean(
    process.env.EAUTOMATE_COOKIE?.trim() || process.env.EAUTOMATE_BEARER_TOKEN?.trim()
  );
}
