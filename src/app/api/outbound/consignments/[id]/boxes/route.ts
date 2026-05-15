import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { getOutboundConsignmentById } from "@/server/services/outboundConsignmentsService";
import { insertOutboundConsignmentBoxLines } from "@/server/services/outboundConsignmentItemsService";

type Ctx = { params: Promise<{ id: string }> };

type Body = {
  box_name?: unknown;
  box_number?: unknown;
  items?: unknown;
};

function parseBody(raw: Body): {
  box_name: string;
  box_number: number;
  items: { po_secondary_sku: string; quantity: number }[];
} {
  const box_name =
    typeof raw.box_name === "string" ? raw.box_name.trim() : "";
  const box_number = Number(raw.box_number);
  if (!box_name) {
    throw new AppError("box_name is required", 400);
  }
  if (!Number.isFinite(box_number) || box_number < 1) {
    throw new AppError("box_number must be a positive integer", 400);
  }
  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    throw new AppError("items must be a non-empty array", 400);
  }
  const items: { po_secondary_sku: string; quantity: number }[] = [];
  for (const row of raw.items) {
    if (row == null || typeof row !== "object" || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    const sku =
      typeof o.po_secondary_sku === "string"
        ? o.po_secondary_sku.trim()
        : typeof o.sku_id === "string"
          ? o.sku_id.trim()
          : "";
    const qty = Number(o.quantity);
    if (!sku || !Number.isFinite(qty) || qty < 1) continue;
    items.push({ po_secondary_sku: sku, quantity: Math.trunc(qty) });
  }
  if (items.length === 0) {
    throw new AppError("No valid items (po_secondary_sku + quantity)", 400);
  }
  return { box_name, box_number, items };
}

export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid consignment id" }, { status: 400 });
    }

    const consignment = await getOutboundConsignmentById(id);
    if (!consignment) {
      return NextResponse.json({ error: "Consignment not found" }, { status: 404 });
    }
    const poNumber = consignment.po_number != null ? String(consignment.po_number) : "";
    if (!poNumber.trim()) {
      return NextResponse.json(
        { error: "Consignment has no po_number; cannot add box lines" },
        { status: 400 }
      );
    }

    const json = (await request.json()) as Body;
    const parsed = parseBody(json);

    const n = await insertOutboundConsignmentBoxLines({
      consignmentId: id,
      poNumber,
      boxNumber: parsed.box_number,
      boxName: parsed.box_name,
      items: parsed.items,
      createdBy: user.email,
    });

    if (n === 0) {
      return NextResponse.json({ error: "No rows inserted" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, inserted: n });
  } catch (err) {
    return handleApiError(err);
  }
}
