type QueryLike = Record<string, string | string[] | undefined>;

export function parsePagination(
  query: QueryLike,
  defaults: { page: number; limit: number; maxLimit?: number } = {
    page: 1,
    limit: 100,
    maxLimit: 200,
  }
) {
  const page = Math.max(
    1,
    parseInt(String(query.page ?? ""), 10) || defaults.page
  );
  const rawLimit = query.limit ?? query.count;
  const limit = Math.min(
    defaults.maxLimit ?? 200,
    Math.max(
      1,
      parseInt(String(rawLimit ?? ""), 10) || defaults.limit
    )
  );
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
