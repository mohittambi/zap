import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { query } from "@/server/db";
import { buildEautomateOutboundPoFileDownloadUrl } from "@/server/eautomate-outbound-po-files";
import { fetchEautomate } from "@/server/eautomate-proxy";
import { eautomateConfigured } from "@/server/eautomate-proxy";

type Ctx = { params: Promise<{ id: string; fileId: string }> };

function safeFilename(name: string | null | undefined): string {
  if (!name || !name.trim()) return "download";
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
}

export async function GET(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { id: poIdStr, fileId: fileIdStr } = await context.params;
    const poId = Number(poIdStr);
    const fileId = Number(fileIdStr);
    if (!Number.isFinite(poId) || poId < 1 || !Number.isFinite(fileId) || fileId < 1) {
      return NextResponse.json({ error: "Invalid PO or file id" }, { status: 400 });
    }

    if (!eautomateConfigured()) {
      return NextResponse.json(
        { error: "eAutomate is not configured for downloads" },
        { status: 503 }
      );
    }

    const r = await query(
      `SELECT f.file_name, o.po_number
       FROM outbound_po_eautomate_files f
       JOIN outbound_purchase_orders o ON o.id = f.outbound_po_id
       WHERE f.eautomate_file_id = $1 AND f.outbound_po_id = $2`,
      [fileId, poId]
    );
    if (r.rows.length === 0) {
      return NextResponse.json({ error: "File not found for this PO" }, { status: 404 });
    }
    const file_name = r.rows[0].file_name as string;
    const po_number = String(r.rows[0].po_number);

    const target = buildEautomateOutboundPoFileDownloadUrl(fileId, po_number);
    if (!target) {
      return NextResponse.json(
        {
          error:
            "Outbound PO file download URL is not configured. Set EAUTOMATE_OUTBOUND_PO_FILE_URL_PATH with placeholders {fileId} and {poNumber} (see docs).",
        },
        { status: 501 }
      );
    }

    const upstream = await fetchEautomate(target.toString(), {
      headers: { Accept: "*/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });

    if (!upstream.ok) {
      const t = await upstream.text().catch(() => "");
      return NextResponse.json(
        { error: `Upstream ${upstream.status}: ${t.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    const ct = upstream.headers.get("content-type") ?? "application/octet-stream";
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Content-Disposition": `attachment; filename="${safeFilename(file_name)}"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
