import { query } from "@/server/db";

export type OutboundPoRow = {
  id: number;
  sold_via: string | null;
  company_id: number | null;
  po_number: string;
  delivery_city: string | null;
  delivery_address: string | null;
  billing_address: string | null;
  buyer_gstin: string | null;
  po_issue_date: string | null;
  expiry_date: string | null;
  po_type: string | null;
  po_creation_status: string | null;
  po_acknowledgement_status: string | null;
  po_fulfillment_status: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_wip: string | null;
  remarks: string | null;
  company_name: string | null;
  analytics_object: Record<string, unknown>;
  calculated_po_status: string | null;
};

function rowToApi(r: Record<string, unknown>): OutboundPoRow {
  const ao = r.analytics_object;
  return {
    id: Number(r.id),
    sold_via: r.sold_via as string | null,
    company_id: r.company_id != null ? Number(r.company_id) : null,
    po_number: String(r.po_number),
    delivery_city: r.delivery_city as string | null,
    delivery_address: r.delivery_address as string | null,
    billing_address: r.billing_address as string | null,
    buyer_gstin: r.buyer_gstin as string | null,
    po_issue_date: r.po_issue_date ? new Date(r.po_issue_date as string).toISOString().replace("T", " ").slice(0, 19) : null,
    expiry_date: r.expiry_date ? new Date(r.expiry_date as string).toISOString().replace("T", " ").slice(0, 19) : null,
    po_type: r.po_type as string | null,
    po_creation_status: r.po_creation_status as string | null,
    po_acknowledgement_status: r.po_acknowledgement_status as string | null,
    po_fulfillment_status: r.po_fulfillment_status as string | null,
    created_by: r.created_by as string | null,
    created_at: r.created_at ? new Date(r.created_at as string).toISOString() : null,
    updated_at: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
    is_wip: r.is_wip as string | null,
    remarks: r.remarks as string | null,
    company_name: r.company_name as string | null,
    analytics_object:
      typeof ao === "object" && ao !== null && !Array.isArray(ao)
        ? (ao as Record<string, unknown>)
        : {},
    calculated_po_status: r.calculated_po_status as string | null,
  };
}

export async function listOutboundPurchaseOrders(opts: {
  page: number;
  limit: number;
  search?: string;
  wipOnly?: boolean;
}) {
  const { page, limit, search, wipOnly } = opts;
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (wipOnly) {
    conditions.push(`is_wip = $${p}`);
    params.push("YES");
    p += 1;
  }

  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    conditions.push(
      `(LOWER(po_number) LIKE $${p} OR LOWER(COALESCE(company_name,'')) LIKE $${p} OR LOWER(COALESCE(delivery_city,'')) LIKE $${p})`
    );
    params.push(q);
    p += 1;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countR = await query(
    `SELECT COUNT(*)::int AS total FROM outbound_purchase_orders ${where}`,
    params
  );
  const total = countR.rows[0].total as number;

  const listR = await query(
    `SELECT id, sold_via, company_id, po_number, delivery_city, delivery_address, billing_address,
            buyer_gstin, po_issue_date, expiry_date, po_type, po_creation_status,
            po_acknowledgement_status, po_fulfillment_status, created_by, created_at, updated_at,
            is_wip, remarks, company_name, analytics_object, calculated_po_status
     FROM outbound_purchase_orders
     ${where}
     ORDER BY created_at DESC NULLS LAST, id DESC
     LIMIT $${p} OFFSET $${p + 1}`,
    [...params, limit, offset]
  );

  const content = listR.rows.map((r) => rowToApi(r as Record<string, unknown>));

  return {
    total,
    current_page: page,
    per_page_count: limit,
    curr_page_count: content.length,
    content,
  };
}
