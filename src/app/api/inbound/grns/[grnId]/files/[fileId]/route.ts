import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { query } from "@/server/db";
import { buildEautomateGrnFileUrl } from "@/server/eautomate-grn-files";
import { fetchEautomate } from "@/server/eautomate-proxy";
import { eautomateConfigured } from "@/server/eautomate-proxy";

type RouteContext = { params: Promise<{ grnId: string; fileId: string }> };

function safeFilename(name: string | null | undefined): string {
  if (!name || !name.trim()) return "download";
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");

    const { grnId: grnIdStr, fileId: fileIdStr } = await context.params;
    const grnId = Number(grnIdStr);
    const fileId = Number(fileIdStr);
    if (!Number.isFinite(grnId) || grnId < 1 || !Number.isFinite(fileId) || fileId < 1) {
      return NextResponse.json({ message: "Invalid grn or file id" }, { status: 400 });
    }

    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    if (kind !== "invoice" && kind !== "debit_note") {
      return NextResponse.json(
        { message: "Query kind=invoice or kind=debit_note is required" },
        { status: 400 }
      );
    }

    if (!eautomateConfigured()) {
      return NextResponse.json(
        { message: "eAutomate is not configured for file proxy" },
        { status: 503 }
      );
    }

    let displayName: string | null = null;

    if (kind === "invoice") {
      const r = await query(
        `SELECT file_name FROM inbound_grn_invoice_files WHERE grn_id = $1 AND file_id = $2`,
        [grnId, fileId]
      );
      if (r.rows.length === 0) {
        return NextResponse.json({ message: "File not found for this GRN" }, { status: 404 });
      }
      displayName = r.rows[0].file_name as string | null;
    } else {
      const noteIdRaw = url.searchParams.get("noteId");
      const noteId = noteIdRaw != null ? Number(noteIdRaw) : NaN;
      if (!Number.isFinite(noteId) || noteId < 1) {
        return NextResponse.json(
          { message: "debit_note downloads require noteId query parameter" },
          { status: 400 }
        );
      }
      const r = await query(
        `SELECT file_name FROM inbound_grn_debit_credit_note_files
         WHERE grn_id = $1 AND note_id = $2 AND file_id = $3`,
        [grnId, noteId, fileId]
      );
      if (r.rows.length === 0) {
        return NextResponse.json({ message: "File not found for this GRN" }, { status: 404 });
      }
      displayName = r.rows[0].file_name as string | null;
    }

    const target = buildEautomateGrnFileUrl(
      kind === "invoice" ? "invoice" : "debit_note",
      grnId,
      fileId,
      kind === "debit_note" ? Number(url.searchParams.get("noteId")) : undefined
    );
    if (!target) {
      return NextResponse.json(
        {
          message:
            "File download URL is not configured. Set EAUTOMATE_GRN_INVOICE_FILE_URL_PATH or EAUTOMATE_GRN_DCN_FILE_URL_PATH (placeholders {fileId}, {grnId}, {noteId}).",
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
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        {
          message: `eAutomate file fetch failed (${upstream.status})`,
          detail: text.slice(0, 200),
        },
        { status: upstream.status >= 500 ? 502 : upstream.status }
      );
    }

    const blob = await upstream.arrayBuffer();
    const contentType =
      upstream.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
    const fn = safeFilename(displayName);

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fn}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
