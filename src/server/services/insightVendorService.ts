import { query } from "@/server/db";
import { buildVendorReliability } from "@/lib/vendorReliabilityScore";

export async function getVendorReliabilityScores(limit = 50) {
  const r = await query(
    `WITH grn_stats AS (
       SELECT vendor_id,
              COUNT(*)::int AS grn_count,
              COALESCE(SUM(grn_accepted_quantity)::numeric / NULLIF(SUM(grn_invoice_quantity), 0) * 100, 0) AS acceptance_rate_pct,
              COALESCE(SUM(grn_shortage_quantity)::numeric / NULLIF(SUM(grn_invoice_quantity), 0) * 100, 0) AS shortage_rate_pct
       FROM inbound_grns
       WHERE vendor_id IS NOT NULL
         AND created_at >= NOW() - INTERVAL '90 days'
       GROUP BY vendor_id
     ),
     dn_stats AS (
       SELECT g.vendor_id,
              COUNT(DISTINCT dn.grn_id)::int AS rate_diff_dn_count
       FROM inbound_zap_debit_notes dn
       JOIN inbound_grns g ON g.grn_id = dn.grn_id
       WHERE dn.generated_at >= NOW() - INTERVAL '90 days'
       GROUP BY g.vendor_id
     )
     SELECT v.vendor_id,
            COALESCE(v.vendor_name, v.vendor_id::text) AS vendor_name,
            COALESCE(gs.grn_count, 0) AS grn_count,
            COALESCE(gs.acceptance_rate_pct, 0) AS acceptance_rate_pct,
            COALESCE(gs.shortage_rate_pct, 0) AS shortage_rate_pct,
            COALESCE(ds.rate_diff_dn_count, 0) AS rate_diff_dn_count
     FROM (SELECT DISTINCT vendor_id, vendor_name FROM inbound_grns WHERE vendor_id IS NOT NULL) v
     LEFT JOIN grn_stats gs ON gs.vendor_id = v.vendor_id
     LEFT JOIN dn_stats ds ON ds.vendor_id = v.vendor_id
     ORDER BY gs.grn_count DESC NULLS LAST
     LIMIT $1`,
    [limit]
  );

  return r.rows.map((row) =>
    buildVendorReliability({
      vendor_id: Number(row.vendor_id),
      vendor_name: String(row.vendor_name),
      grn_count: Number(row.grn_count),
      acceptance_rate_pct: Number(row.acceptance_rate_pct),
      shortage_rate_pct: Number(row.shortage_rate_pct),
      rate_diff_dn_count: Number(row.rate_diff_dn_count),
    })
  );
}
