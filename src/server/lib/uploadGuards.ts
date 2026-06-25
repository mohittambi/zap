import { AppError } from "@/server/errors";

export function assertFileSize(file: File, maxBytes: number): void {
  if (file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    throw new AppError(`File must be ${maxMb}MB or smaller`, 400);
  }
}

export function assertBlobSize(blob: Blob, maxBytes: number): void {
  if (blob.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    throw new AppError(`File must be ${maxMb}MB or smaller`, 400);
  }
}

export function assertFileType(
  file: File,
  allowedExtensions: string[],
  allowedMimeTypes: string[]
): void {
  const name = file.name.toLowerCase();
  const ext = name.match(/\.([^.]+)$/)?.[1] ?? "";
  const extOk = allowedExtensions.includes(ext);
  if (!extOk) {
    throw new AppError(
      `File must be one of: ${allowedExtensions.map((e) => `.${e}`).join(", ")}`,
      400
    );
  }
  const mt = (file.type || "").toLowerCase();
  if (mt === "") return;
  const mimeOk = allowedMimeTypes.some((m) => m.toLowerCase() === mt);
  if (!mimeOk) {
    throw new AppError(
      `File type not allowed (got ${mt || "unknown"})`,
      400
    );
  }
}

export const INVOICE_FILE_EXTENSIONS = ["jpg", "jpeg", "pdf"] as const;
export const INVOICE_FILE_MIME_TYPES = [
  "image/jpeg",
  "application/pdf",
  "image/jpg",
  "image/pjpeg",
] as const;

export function assertInvoiceLikeFile(file: File, maxBytes: number): void {
  assertFileSize(file, maxBytes);
  assertFileType(file, [...INVOICE_FILE_EXTENSIONS], [...INVOICE_FILE_MIME_TYPES]);
}
