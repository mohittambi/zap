// @ts-nocheck
import { query } from "@/server/db";

export const FAVOURITE_ENTITY_TYPES = [
  "bin",
  "purchase_order",
  "consignment",
  "sku",
] as const;

export type FavouriteEntityType = (typeof FAVOURITE_ENTITY_TYPES)[number];

type FavouriteRow = {
  id: string;
  entity: FavouriteEntityType;
  entity_id: string;
  title: string | null;
  subtitle: string | null;
  created_at: string;
};

/** Lists favourites for a user, ordered by created_at DESC. Paginated. */
export async function listFavouritesForUser(params: {
  userId: number;
  entityType?: string;
  limit: number;
  offset: number;
}): Promise<{ rows: FavouriteRow[]; total: number }> {
  const { userId, entityType, limit, offset } = params;
  const filters: unknown[] = [userId];
  let where = "WHERE user_id = $1";
  if (entityType) {
    filters.push(entityType);
    where += ` AND entity_type = $${filters.length}`;
  }

  const totalRes = await query(
    `SELECT COUNT(*)::int AS total FROM favourites ${where}`,
    filters
  );
  const total = Number(totalRes.rows[0]?.total ?? 0);

  const pageParams = [...filters, limit, offset];
  const r = await query(
    `SELECT id::text                          AS id,
            entity_type                       AS entity,
            entity_id                         AS entity_id,
            title                             AS title,
            subtitle                          AS subtitle,
            to_char(created_at AT TIME ZONE 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM favourites
       ${where}
       ORDER BY created_at DESC
       LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
    pageParams
  );

  return { rows: r.rows as FavouriteRow[], total };
}

/** Upsert: if (user, entity_type, entity_id) already exists, refresh title/subtitle. */
export async function upsertFavourite(params: {
  userId: number;
  entityType: FavouriteEntityType;
  entityId: string;
  title: string | null;
  subtitle: string | null;
}): Promise<FavouriteRow> {
  const { userId, entityType, entityId, title, subtitle } = params;
  const r = await query(
    `INSERT INTO favourites (user_id, entity_type, entity_id, title, subtitle)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE
       SET title      = COALESCE(EXCLUDED.title, favourites.title),
           subtitle   = COALESCE(EXCLUDED.subtitle, favourites.subtitle),
           updated_at = NOW()
     RETURNING id::text                          AS id,
               entity_type                       AS entity,
               entity_id                         AS entity_id,
               title                             AS title,
               subtitle                          AS subtitle,
               to_char(created_at AT TIME ZONE 'UTC',
                       'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`,
    [userId, entityType, entityId, title, subtitle]
  );
  return r.rows[0] as FavouriteRow;
}

/** Deletes a favourite row only if it belongs to the calling user.
 *  Returns true if a row was deleted. */
export async function deleteFavouriteForUser(params: {
  userId: number;
  favouriteId: number;
}): Promise<boolean> {
  const r = await query(
    `DELETE FROM favourites WHERE id = $1 AND user_id = $2`,
    [params.favouriteId, params.userId]
  );
  return (r.rowCount ?? 0) > 0;
}

/** Looks up a single favourite by (user, entity_type, entity_id). Used by
 *  client toggle buttons to know their initial state. */
export async function findFavouriteForUser(params: {
  userId: number;
  entityType: FavouriteEntityType;
  entityId: string;
}): Promise<FavouriteRow | null> {
  const r = await query(
    `SELECT id::text                          AS id,
            entity_type                       AS entity,
            entity_id                         AS entity_id,
            title                             AS title,
            subtitle                          AS subtitle,
            to_char(created_at AT TIME ZONE 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM favourites
       WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3`,
    [params.userId, params.entityType, params.entityId]
  );
  return (r.rows[0] as FavouriteRow | undefined) ?? null;
}
