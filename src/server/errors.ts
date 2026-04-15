import { NextResponse } from "next/server";

export class AppError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode = 500, code?: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function publicErrorMessage(err: unknown): string {
  if (err instanceof AggregateError && Array.isArray(err.errors) && err.errors.length > 0) {
    const parts = err.errors
      .map((e) => (e instanceof Error ? e.message : String(e)))
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts.join("; ");
  }
  if (err instanceof Error) {
    const m = err.message?.trim();
    if (m) return m;
    if (err.name && err.name !== "Error") return err.name;
  }
  return "Internal server error";
}

export function handleApiError(err: unknown): NextResponse {
  const statusCode =
    err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof AppError ? err.message : publicErrorMessage(err);
  const code = err instanceof AppError ? err.code : undefined;

  if (statusCode >= 500) {
    console.error(err);
  }

  const safeMessage =
    message.trim() || (statusCode >= 500 ? "Internal server error" : "Request failed");

  const body =
    code != null ? { error: safeMessage, code } : { error: safeMessage };

  return NextResponse.json(body, { status: statusCode });
}
