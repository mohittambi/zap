import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as focusListsService from "@/server/services/focusListsService";

/**
 * @swagger
 * /focus-lists/{id}/items:
 *   get:
 *     summary: List items in a focus list
 *     description: Requires focus_lists:read.
 *     tags: [Focus Lists]
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
 *     summary: Add SKU to focus list
 *     description: Requires focus_lists:write.
 *     tags: [Focus Lists]
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
 *             required: [sku_id]
 *             properties:
 *               sku_id: { type: string }
 *     responses:
 *       200: { description: OK }
 *       400: { description: sku_id required }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *   delete:
 *     summary: Remove SKU from focus list
 *     description: Requires focus_lists:write.
 *     tags: [Focus Lists]
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
 *       400: { description: sku_id required }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(_request);
    assertPermission(user, "focus_lists", "read");
    const { id } = await context.params;
    const data = await focusListsService.listFocusListItems(Number(id));
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
    assertPermission(user, "focus_lists", "write");
    const { id } = await context.params;
    const body = await request.json();
    const skuId = String(body.sku_id ?? "").trim();
    if (!skuId) {
      return NextResponse.json({ error: "sku_id required" }, { status: 400 });
    }
    await focusListsService.addFocusListItem(Number(id), skuId);
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
    assertPermission(user, "focus_lists", "write");
    const { id } = await context.params;
    const u = new URL(request.url);
    const skuId = u.searchParams.get("sku_id");
    if (!skuId) {
      return NextResponse.json({ error: "sku_id query required" }, { status: 400 });
    }
    await focusListsService.removeFocusListItem(Number(id), skuId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
