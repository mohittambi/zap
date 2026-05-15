import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getBinChanges } from "@/server/services/binsService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");

    const { searchParams } = new URL(request.url);

    const result = await getBinChanges({
      sku_id: searchParams.get("sku_id") ?? undefined,
      bin_id: searchParams.get("bin_id") ?? undefined,
      movement_type: searchParams.get("movement_type") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      page: 1,
      limit: 100000,
    });

    const headers = ["Time", "Warehouse", "SKU", "Description", "Bin", "Operation", "Movement Type", "Qty", "Changed By"];
    const rows = result.data.map((r) => [
      r.created_at ? new Date(r.created_at).toLocaleString("en-IN") : "",
      r.warehouse_id,
      r.sku_id,
      r.description ?? "",
      r.bin_id ?? "",
      r.inventory_operation_type,
      r.movement_type ?? "",
      r.quantity,
      r.user_id ?? "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [
      { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 30 },
      { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 8 }, { wch: 28 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bin Changes");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="bin-changes-export.xlsx"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
