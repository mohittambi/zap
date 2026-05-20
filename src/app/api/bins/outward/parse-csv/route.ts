import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";

type ParsedItem = { sku_id: string; required_qty: number };
type ParseError = { row: number; message: string };

/**
 * @swagger
 * /bins/outward/parse-csv:
 *   post:
 *     summary: Parse uploaded CSV/XLSX into outward items
 *     description: Requires purchase_orders:write.
 *     tags: [Bins]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200: { description: OK }
 *       400: { description: file required }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");

    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    const items: ParsedItem[] = [];
    const errors: ParseError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed + header row

      const rawSku = String(row["sku_id"] ?? row["SKU ID"] ?? row["sku"] ?? "").trim();
      if (!rawSku) {
        errors.push({ row: rowNum, message: "sku_id is required" });
        continue;
      }

      const rawQty = row["required_qty"] ?? row["Required Qty"] ?? row["qty"] ?? row["quantity"] ?? "";
      const qty = Number(rawQty);
      if (!Number.isInteger(qty) || qty < 1) {
        errors.push({ row: rowNum, message: `required_qty must be a positive integer (got "${rawQty}")` });
        continue;
      }

      items.push({ sku_id: rawSku, required_qty: qty });
    }

    return NextResponse.json({ items, errors });
  } catch (err) {
    return handleApiError(err);
  }
}
