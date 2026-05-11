import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";

type CommitBinResult = { bin_id: string; deducted: number; new_qty: number };
type CommitSkuResult = { sku_id: string; total_deducted: number; bins: CommitBinResult[] };

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");

    const body = await request.json() as {
      committed_at: string;
      results: CommitSkuResult[];
      descriptions: Record<string, string>;
    };

    const { results, descriptions, committed_at } = body;
    const ts = committed_at ? new Date(committed_at).toLocaleString("en-IN") : new Date().toLocaleString("en-IN");

    const wb = XLSX.utils.book_new();

    // Sheet 1: per-bin detail
    const detailHeaders = ["SKU", "Description", "Bin", "Prev Qty", "Deducted", "New Qty"];
    const detailRows: (string | number)[][] = [];
    let grandTotal = 0;
    for (const sku of results) {
      for (const bin of sku.bins) {
        detailRows.push([
          sku.sku_id,
          descriptions[sku.sku_id] ?? "",
          bin.bin_id,
          bin.new_qty + bin.deducted,
          bin.deducted,
          bin.new_qty,
        ]);
        grandTotal += bin.deducted;
      }
    }
    detailRows.push(["", "", "TOTAL", "", grandTotal, ""]);

    const ws1 = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
    ws1["!cols"] = [{ wch: 20 }, { wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Bin Changes");

    // Sheet 2: SKU summary
    const summaryHeaders = ["SKU", "Description", "Total Deducted"];
    const summaryRows = results.map(r => [r.sku_id, descriptions[r.sku_id] ?? "", r.total_deducted]);
    const ws2 = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
    ws2["!cols"] = [{ wch: 20 }, { wch: 30 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Summary");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const slug = ts.replaceAll("/", "-").replaceAll(":", "-").replaceAll(", ", "_").replaceAll(" ", "_");

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="bin-changes-${slug}.xlsx"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
