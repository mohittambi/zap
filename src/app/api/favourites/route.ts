import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { AppError, handleApiError } from "@/server/errors";
import {
  FAVOURITE_ENTITY_TYPES,
  listFavouritesForUser,
  upsertFavourite,
  type FavouriteEntityType,
} from "@/server/services/favouritesService";

const VALID_TYPES = new Set<FavouriteEntityType>(FAVOURITE_ENTITY_TYPES);

/**
 * @swagger
 * /favourites:
 *   get:
 *     summary: List the current user's favourites (paginated)
 *     description: |
 *       Returns favourites belonging to the authenticated user only. Use
 *       `entity_type` to filter to a single kind (bin / purchase_order /
 *       consignment / sku).
 *     tags: [Favourites]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1, minimum: 1 } }
 *       - { in: query, name: page_size, schema: { type: integer, default: 20, minimum: 1, maximum: 200 } }
 *       - { in: query, name: entity_type, schema: { type: string, enum: [bin, purchase_order, consignment, sku] } }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:         { type: string }
 *                       entity:     { type: string, enum: [bin, purchase_order, consignment, sku] }
 *                       entity_id:  { type: string }
 *                       title:      { type: string, nullable: true }
 *                       subtitle:   { type: string, nullable: true }
 *                       created_at: { type: string, format: date-time }
 *                 page:      { type: integer }
 *                 page_size: { type: integer }
 *                 total:     { type: integer }
 *                 has_more:  { type: boolean }
 *       401: { description: Unauthorized }
 *   post:
 *     summary: Add (or refresh) a favourite for the current user
 *     description: |
 *       Idempotent on (user, entity_type, entity_id). Sending the same pair
 *       again is not an error; it refreshes the cached title/subtitle.
 *     tags: [Favourites]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entity_type, entity_id]
 *             properties:
 *               entity_type: { type: string, enum: [bin, purchase_order, consignment, sku] }
 *               entity_id:   { type: string }
 *               title:       { type: string, nullable: true }
 *               subtitle:    { type: string, nullable: true }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const u = new URL(request.url);

    const pageRaw = parseInt(u.searchParams.get("page") ?? "", 10);
    const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

    const sizeRaw = parseInt(
      u.searchParams.get("page_size") ??
        u.searchParams.get("limit") ??
        "",
      10
    );
    const pageSize = Math.min(
      200,
      Math.max(1, Number.isFinite(sizeRaw) && sizeRaw >= 1 ? sizeRaw : 20)
    );

    const entityTypeRaw = u.searchParams.get("entity_type") ?? undefined;
    if (entityTypeRaw && !VALID_TYPES.has(entityTypeRaw as FavouriteEntityType)) {
      throw new AppError(
        `Invalid entity_type. Allowed: ${FAVOURITE_ENTITY_TYPES.join(", ")}`,
        400
      );
    }

    const { rows, total } = await listFavouritesForUser({
      userId: user.id,
      entityType: entityTypeRaw,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return NextResponse.json({
      data: rows,
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const entityType = typeof body.entity_type === "string"
      ? body.entity_type.trim()
      : "";
    const entityId = typeof body.entity_id === "string"
      ? body.entity_id.trim()
      : "";

    if (!entityType || !VALID_TYPES.has(entityType as FavouriteEntityType)) {
      throw new AppError(
        `entity_type is required. Allowed: ${FAVOURITE_ENTITY_TYPES.join(", ")}`,
        400
      );
    }
    if (!entityId) {
      throw new AppError("entity_id is required", 400);
    }

    const title = typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 500)
      : null;
    const subtitle = typeof body.subtitle === "string" && body.subtitle.trim()
      ? body.subtitle.trim().slice(0, 500)
      : null;

    const row = await upsertFavourite({
      userId: user.id,
      entityType: entityType as FavouriteEntityType,
      entityId,
      title,
      subtitle,
    });

    return NextResponse.json(row);
  } catch (err) {
    return handleApiError(err);
  }
}
