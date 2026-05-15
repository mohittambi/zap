import {
  migrateLayout,
  type DashboardLayoutV2,
} from "@/lib/dashboard-card-ids";

// URL-safe base64 (no `+`, `/`, `=`). Used in the `#layout=…` fragment.

function b64UrlEncode(s: string): string {
  if (typeof btoa !== "function") {
    // SSR fallback — Node has Buffer, but this code is only ever called from
    // the client. The branch keeps the bundler happy.
    return Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  // Encode UTF-8 → bytes → base64.
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64UrlDecode(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  if (typeof atob !== "function") {
    return Buffer.from(padded, "base64").toString("utf8");
  }
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeLayout(layout: DashboardLayoutV2): string {
  return b64UrlEncode(JSON.stringify(layout));
}

export function decodeLayout(encoded: string): DashboardLayoutV2 | null {
  try {
    const json = b64UrlDecode(encoded);
    const raw = JSON.parse(json);
    const migrated = migrateLayout(raw);
    if (migrated.version !== 2) return null;
    return migrated;
  } catch {
    return null;
  }
}

/** Read `#layout=…` from window.location.hash; returns null if absent / invalid. */
export function readLayoutFromHash(): DashboardLayoutV2 | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash || !hash.includes("layout=")) return null;
  const m = /(?:^|[#&])layout=([^&]+)/.exec(hash);
  if (!m) return null;
  return decodeLayout(decodeURIComponent(m[1]));
}

export function buildShareUrl(layout: DashboardLayoutV2): string {
  if (typeof window === "undefined") return "";
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#layout=${encodeLayout(layout)}`;
}
