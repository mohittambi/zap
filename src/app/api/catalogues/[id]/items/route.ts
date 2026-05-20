import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as cataloguesService from "@/server/services/cataloguesService";

/**
 * @swagger
 * /catalogues/{id}/items:
 *   get:
 *     summary: List catalogue items
 *     description: Requires catalogues:read.
 *     tags: [Catalogues]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *   post:
 *     summary: Add a catalogue item
 *     description: Requires catalogues:write.
 *     tags: [Catalogues]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sku_id: { type: string }
 *               moq: { type: integer }
 *               display_price: { type: number }
 *               sort_order: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *   delete:
 *     summary: Remove a catalogue item
 *     description: Requires catalogues:write.
 *     tags: [Catalogues]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: sku_id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       400: { description: sku_id is required }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(_request);
    assertPermission(user, "catalogues", "read");
    const { id } = await context.params;
    const data = await cataloguesService.listCatalogueItems(Number(id));
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "catalogues", "write");
    const { id } = await context.params;
    const body = await request.json();
    await cataloguesService.addCatalogueItem(Number(id), {
      sku_id: body.sku_id,
      moq: body.moq,
      display_price: body.display_price,
      sort_order: body.sort_order,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "catalogues", "write");
    const { id } = await context.params;
    const u = new URL(request.url);
    const skuId = u.searchParams.get("sku_id");
    if (!skuId) {
      return NextResponse.json({ error: "sku_id query required" }, { status: 400 });
    }
    await cataloguesService.removeCatalogueItem(Number(id), skuId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
