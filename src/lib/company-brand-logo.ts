/**
 * Marketplace / buyer company logos for web UI.
 * Prefer `logo_url` from `companies.attributes`, then bundled `/brand-logos/{key}.png`,
 * then Google favicon by known domain (same heuristic as staff-app `CompanyAvatar`).
 */

export const BRAND_LOGO_BASE_PATH = "/brand-logos";

/** Bundled PNG filenames under `public/brand-logos/`. */
export const BRAND_KEYS = [
  "amazon",
  "blinkit",
  "flipkart",
  "zepto",
  "swiggy",
  "bigbasket",
  "instamart",
  "myntra",
  "dmart",
  "pepperfry",
  "vaaree",
  "more",
  "slikk",
  "jiomart",
  "meesho",
  "ajio",
  "nykaa",
  "dunzo",
  "tatacliq",
] as const;

export type BrandKey = (typeof BRAND_KEYS)[number];

/** Domains used to fetch favicons when bundling logos (`npm run download:company-logos`). */
export const BRAND_DOMAINS: Record<BrandKey, string> = {
  amazon: "amazon.in",
  blinkit: "blinkit.com",
  flipkart: "flipkart.com",
  zepto: "zeptonow.com",
  swiggy: "swiggy.com",
  bigbasket: "bigbasket.com",
  instamart: "swiggy.com",
  myntra: "myntra.com",
  dmart: "dmart.in",
  pepperfry: "pepperfry.com",
  vaaree: "vaaree.com",
  more: "moreretail.in",
  slikk: "slikkclub.com",
  jiomart: "jiomart.com",
  meesho: "meesho.com",
  ajio: "ajio.com",
  nykaa: "nykaa.com",
  dunzo: "dunzo.com",
  tatacliq: "tatacliq.com",
};

/** Substring needles → domain for favicon fallback (includes brands without bundled PNG). */
const DOMAIN_NEEDLES: readonly [string, string][] = [
  ["blinkit", "blinkit.com"],
  ["grofers", "blinkit.com"],
  ["amazon", "amazon.in"],
  ["amzn", "amazon.in"],
  ["cloudtail", "amazon.in"],
  ["etrade", "amazon.in"],
  ["flipkart", "flipkart.com"],
  ["flip kart", "flipkart.com"],
  ["zepto", "zeptonow.com"],
  ["swiggy", "swiggy.com"],
  ["instamart", "swiggy.com"],
  ["bigbasket", "bigbasket.com"],
  ["big basket", "bigbasket.com"],
  ["myntra", "myntra.com"],
  ["dmart", "dmart.in"],
  ["d-mart", "dmart.in"],
  ["pepperfry", "pepperfry.com"],
  ["vaaree", "vaaree.com"],
  ["more retail", "moreretail.com"],
  ["slikk", "slikk.in"],
  ["jiomart", "jiomart.com"],
  ["meesho", "meesho.com"],
  ["ajio", "ajio.com"],
  ["nykaa", "nykaa.com"],
  ["dunzo", "dunzo.com"],
  ["tata cliq", "tatacliq.com"],
  ["tatacliq", "tatacliq.com"],
];

export function matchBrandKey(companyName: string): BrandKey | null {
  const n = companyName.toLowerCase();
  if (n.includes("amazon") || n.includes("amzn") || n.includes("cloudtail")) {
    return "amazon";
  }
  if (n.includes("blinkit") || n.includes("grofers")) {
    return "blinkit";
  }
  if (n.includes("flipkart") || n.includes("flip kart")) {
    return "flipkart";
  }
  if (n.includes("zepto")) {
    return "zepto";
  }
  if (n.includes("swiggy") && !n.includes("instamart")) {
    return "swiggy";
  }
  if (n.includes("instamart")) {
    return "instamart";
  }
  if (n.includes("bigbasket") || n.includes("big basket")) {
    return "bigbasket";
  }
  if (n.includes("myntra")) {
    return "myntra";
  }
  if (n.includes("dmart") || n.includes("d-mart")) {
    return "dmart";
  }
  if (n.includes("pepperfry")) {
    return "pepperfry";
  }
  if (n.includes("vaaree")) {
    return "vaaree";
  }
  if (n.includes("more retail")) {
    return "more";
  }
  if (n.includes("slikk")) {
    return "slikk";
  }
  if (n.includes("jiomart")) {
    return "jiomart";
  }
  if (n.includes("meesho")) {
    return "meesho";
  }
  if (n.includes("ajio")) {
    return "ajio";
  }
  if (n.includes("nykaa")) {
    return "nykaa";
  }
  if (n.includes("dunzo")) {
    return "dunzo";
  }
  if (n.includes("tata cliq") || n.includes("tatacliq")) {
    return "tatacliq";
  }
  return null;
}

export function localBrandLogoPath(key: BrandKey): string {
  return `${BRAND_LOGO_BASE_PATH}/${key}.png`;
}

export function faviconUrlForDomain(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

function domainForCompanyName(companyName: string): string | null {
  const n = companyName.toLowerCase();
  for (const [needle, domain] of DOMAIN_NEEDLES) {
    if (n.includes(needle)) return domain;
  }
  return null;
}

/**
 * Resolved logo URL for `<img src>` — DB attribute, bundled asset path, or remote favicon.
 */
export function resolveCompanyLogoUrl(
  companyName?: string | null,
  logoUrlFromDb?: string | null
): string | null {
  const fromDb = logoUrlFromDb?.trim();
  if (fromDb) return fromDb;

  const name = companyName?.trim();
  if (!name) return null;

  const key = matchBrandKey(name);
  if (key) return localBrandLogoPath(key);

  const domain = domainForCompanyName(name);
  if (domain) return faviconUrlForDomain(domain);

  return null;
}

export function companyLogoFromAttributes(attributes: unknown): string | null {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    return null;
  }
  const att = attributes as Record<string, unknown>;
  const raw =
    att.logo_url ?? att.logoUrl ?? att.logo ?? att.company_logo_url ?? att.companyLogoUrl;
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length ? t : null;
}

export function resolveCompanyLogoFromAttributes(
  companyName?: string | null,
  attributes?: unknown
): string | null {
  return resolveCompanyLogoUrl(companyName, companyLogoFromAttributes(attributes));
}

/** Stable hue index for initials fallback (matches staff-app palette length). */
export function companyLogoSeed(name: string, id?: number): number {
  if (id != null && Number.isFinite(id)) return Math.abs(id);
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const COMPANY_LOGO_PALETTE = [
  "#1B998B",
  "#2E5BFF",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#0EA5E9",
  "#EC4899",
  "#14B8A6",
] as const;

export function companyInitials(name?: string | null): string {
  const n = (name ?? "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase();
}
