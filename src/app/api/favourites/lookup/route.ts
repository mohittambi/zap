import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { AppError, handleApiError } from "@/server/errors";
import {
  FAVOURITE_ENTITY_TYPES,
  findFavouriteForUser,
  type FavouriteEntityType,
} from "@/server/services/favouritesService";

const VALID_TYPES = new Set<FavouriteEntityType>(FAVOURITE_ENTITY_TYPES);

/**
 * @swagger
 * /favourites/lookup:
 *   get:
 *     summary: Check whether a specific entity is favourited by the current user
 *     description: |
 *       Used by client toggle buttons (heart icon) on detail screens to seed
 *       their initial state. Returns the matching favourite row or `null`.
 *     tags: [Favourites]
 *     parameters:
 *       - in: query
 *         name: entity_type
 *         required: true
 *         schema: { type: string, enum: [bin, purchase_order, consignment, sku] }
 *       - in: query
 *         name: entity_id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 favourited: { type: boolean }
 *                 favourite:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:         { type: string }
 *                     entity:     { type: string }
 *                     entity_id:  { type: string }
 *                     title:      { type: string, nullable: true }
 *                     subtitle:   { type: string, nullable: true }
 *                     created_at: { type: string, format: date-time }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const u = new URL(request.url);

    const entityType = (u.searchParams.get("entity_type") ?? "").trim();
    const entityId = (u.searchParams.get("entity_id") ?? "").trim();

    if (!entityType || !VALID_TYPES.has(entityType as FavouriteEntityType)) {
      throw new AppError(
        `entity_type is required. Allowed: ${FAVOURITE_ENTITY_TYPES.join(", ")}`,
        400
      );
    }
    if (!entityId) {
      throw new AppError("entity_id is required", 400);
    }

    const row = await findFavouriteForUser({
      userId: user.id,
      entityType: entityType as FavouriteEntityType,
      entityId,
    });

    return NextResponse.json({
      favourited: row != null,
      favourite: row,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
