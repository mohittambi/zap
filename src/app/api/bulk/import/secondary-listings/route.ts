import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as bulkService from "@/server/services/bulkService";

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bulk", "import");
    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const data = await bulkService.importSecondaryListingsFromBuffer(buf);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
