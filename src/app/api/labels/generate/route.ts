import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { buildLabelsPdf, type LabelRow } from "@/server/services/labelPdfService";

type GenerateBody = {
  rows?: LabelRow[];
  labelSize?: "70x40" | "75x38";
};

function safeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "create");

    let body: GenerateBody = {};
    try {
      body = (await request.json()) as GenerateBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (rows.length === 0) {
      return NextResponse.json({ error: "rows must be a non-empty array" }, { status: 400 });
    }
    const labelSize = body.labelSize === "75x38" ? "75x38" : "70x40";

    const pdfBytes = await buildLabelsPdf(rows, labelSize);
    const fname = `product-labels-${safeFilename(new Date().toISOString())}.pdf`;
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fname}"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

