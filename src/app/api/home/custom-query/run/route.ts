import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError, AppError } from "@/server/errors";
import { query } from "@/server/db";
import { MODULE_MAP, OPERATORS_BY_TYPE, type Operator } from "@/server/queries/queryBuilderModules";

type ConditionInput = {
  field: string;
  op: string;
  value?: string;
  value2?: string;
};

const ALLOWED_LIMITS = new Set([50, 100, 250, 500, 1000, 5000]);

type QuerySpec = {
  module: string;
  conditions: ConditionInput[];
  columns: string[];
  result_shape: "table" | "bar" | "line";
  limit?: number;
};

const VALID_OPS = new Set<string>([
  "eq", "neq", "gt", "gte", "lt", "lte", "between", "contains", "starts", "is_null", "not_null",
]);

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "read");

    const body = (await request.json()) as QuerySpec;
    const mod = MODULE_MAP.get(body.module ?? "");
    if (!mod) throw new AppError("Unknown module", 400);

    const fieldMap = new Map(mod.fields.map((f) => [f.name, f]));

    // Validate and resolve requested columns
    const requestedCols = Array.isArray(body.columns) && body.columns.length > 0
      ? body.columns
      : mod.defaultColumns;
    const validCols = requestedCols.filter((c) => fieldMap.has(c));
    if (validCols.length === 0) throw new AppError("No valid columns selected", 400);

    // Validate result shape
    const resultShape =
      body.result_shape === "bar" || body.result_shape === "line"
        ? body.result_shape
        : "table";

    // Build SELECT clause
    const selectParts = validCols.map((name) => {
      const f = fieldMap.get(name)!;
      return `${f.column} AS "${name}"`;
    });

    // Build WHERE clause from conditions
    const params: unknown[] = [];
    const whereClauses: string[] = [];

    for (const cond of (body.conditions ?? [])) {
      const field = fieldMap.get(cond.field);
      if (!field) continue;
      if (!VALID_OPS.has(cond.op)) continue;

      // Check operator is valid for this field type
      const validOps = OPERATORS_BY_TYPE[field.type].map((o) => o.op);
      if (!validOps.includes(cond.op as Operator)) continue;

      const col = field.column;
      const op = cond.op as Operator;

      if (op === "is_null") {
        whereClauses.push(`${col} IS NULL`);
        continue;
      }
      if (op === "not_null") {
        whereClauses.push(`${col} IS NOT NULL`);
        continue;
      }

      // For date fields cast values
      const cast = field.type === "date" ? "::date" : "";

      if (op === "between") {
        if (!cond.value || !cond.value2) continue;
        params.push(cond.value);
        params.push(cond.value2);
        whereClauses.push(`${col} >= $${params.length - 1}${cast} AND ${col} <= $${params.length}${cast}`);
        continue;
      }

      if (!cond.value && cond.value !== "0") continue;

      if (op === "contains") {
        params.push(`%${cond.value}%`);
        whereClauses.push(`${col} ILIKE $${params.length}`);
      } else if (op === "starts") {
        params.push(`${cond.value}%`);
        whereClauses.push(`${col} ILIKE $${params.length}`);
      } else {
        const sqlOp =
          op === "eq" ? "=" :
          op === "neq" ? "!=" :
          op === "gt" ? ">" :
          op === "gte" ? ">=" :
          op === "lt" ? "<" :
          op === "lte" ? "<=" : "=";
        params.push(field.type === "number" ? Number(cond.value) : cond.value);
        whereClauses.push(`${col} ${sqlOp} $${params.length}${cast}`);
      }
    }

    const rowLimit = body.limit != null && ALLOWED_LIMITS.has(body.limit) ? body.limit : 500;
    const fromClause = `${mod.table} ${mod.tableAlias}${mod.joins ? ` ${mod.joins}` : ""}`;
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const sql = `SELECT ${selectParts.join(", ")} FROM ${fromClause} ${whereClause} LIMIT ${rowLimit}`;

    const result = await query(sql, params);
    const columns = result.fields.map((f) => f.name);
    const rows = result.rows.map((row) =>
      columns.map((col) => (row as Record<string, unknown>)[col] ?? null)
    );

    return NextResponse.json({ columns, rows, result_shape: resultShape });
  } catch (err) {
    return handleApiError(err);
  }
}
