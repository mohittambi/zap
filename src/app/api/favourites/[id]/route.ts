import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { AppError, handleApiError } from "@/server/errors";
import { deleteFavouriteForUser } from "@/server/services/favouritesService";

/**
 * @swagger
 * /favourites/{id}:
 *   delete:
 *     summary: Remove one of the current user's favourites
 *     description: Only deletes if the favourite belongs to the authenticated user.
 *     tags: [Favourites]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Invalid favourite id }
 *       401: { description: Unauthorized }
 *       404: { description: Not found }
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await context.params;
    const favouriteId = Number.parseInt(id, 10);
    if (!Number.isFinite(favouriteId) || favouriteId <= 0) {
      throw new AppError("Invalid favourite id", 400);
    }

    const deleted = await deleteFavouriteForUser({
      userId: user.id,
      favouriteId,
    });
    if (!deleted) {
      throw new AppError("Favourite not found", 404);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
