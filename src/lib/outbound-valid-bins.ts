import { apiFetch } from "@/lib/api-browser";

export type OutboundValidBin = { id: number; name: string };

/** GET /api/outbound/box-names — API returns `{ content: rows }`. */
export async function fetchOutboundValidBins(): Promise<OutboundValidBin[]> {
  const raw = await apiFetch<{ content?: OutboundValidBin[] } | OutboundValidBin[]>(
    "/api/outbound/box-names"
  );
  const rows = Array.isArray(raw) ? raw : raw?.content;
  return Array.isArray(rows) ? rows : [];
}
