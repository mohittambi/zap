import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_API_PATHS = new Set(["/api/auth/login"]);

function isPublicApiPath(pathname: string): boolean {
  if (PUBLIC_API_PATHS.has(pathname)) return true;
  if (process.env.NODE_ENV !== "production" && pathname === "/api/api-docs") {
    return true;
  }
  return false;
}

function hasAuthCredentials(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && auth.length > 7) return true;
  const apiKey = request.headers.get("x-api-key");
  return Boolean(apiKey?.trim());
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }
  if (isPublicApiPath(pathname)) {
    return NextResponse.next();
  }
  if (!hasAuthCredentials(request)) {
    return NextResponse.json(
      { error: "Missing authorization" },
      { status: 401 }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
