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

export function handleApiError(err: unknown): NextResponse {
  const statusCode =
    err instanceof AppError ? err.statusCode : 500;
  const message =
    err instanceof AppError ? err.message : "Internal server error";
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
