/** Client IP from proxy headers (Vercel / nginx). */
export function clientIpFromRequest(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip) return ip;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || undefined;
}

export function userAgentFromRequest(request: Request): string | undefined {
  const ua = request.headers.get("user-agent")?.trim();
  return ua || undefined;
}

/** Infer resource module from URL path (app or API). */
export function inferResourceFromPath(path: string): string | undefined {
  const p = path.split("?")[0] ?? path;
  if (p.startsWith("/api/")) {
    const parts = p.slice(5).split("/").filter(Boolean);
    if (parts[0] === "inbound") return "inbound";
    if (parts[0] === "outbound") return "outbound";
    if (parts[0] === "listings") return "listings";
    if (parts[0] === "insights") return "insights";
    if (parts[0] === "bulk") return "bulk";
    if (parts[0] === "admin") return "admin";
    if (parts[0] === "auth") return "auth";
    if (parts[0] === "catalogues") return "catalogues";
    if (parts[0] === "focus-lists") return "focus_lists";
    if (parts[0] === "activity") return "activity";
    return parts[0];
  }
  const parts = p.split("/").filter(Boolean);
  if (parts.length === 0) return "home";
  if (parts[0] === "inbound") return "inbound";
  if (parts[0] === "outbound") return "outbound";
  if (parts[0] === "listings") return "listings";
  if (parts[0] === "insights") return "insights";
  if (parts[0] === "settings") return "settings";
  if (parts[0] === "catalogues") return "catalogues";
  return parts[0];
}
