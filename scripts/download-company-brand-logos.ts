#!/usr/bin/env tsx
/**
 * Download marketplace favicons into `public/brand-logos/` and set `companies.attributes.logo_url`.
 *
 * Usage: npm run download:company-logos
 * Env: DATABASE_URL (optional — skips DB update if unset)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import {
  BRAND_DOMAINS,
  BRAND_KEYS,
  faviconUrlForDomain,
  localBrandLogoPath,
  matchBrandKey,
  type BrandKey,
} from "../src/lib/company-brand-logo";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const outDir = path.join(webRoot, "public", "brand-logos");
const mobileDir = path.join(webRoot, "..", "mobile", "src", "assets", "brand-logos");

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dotenv = require("dotenv");
  dotenv.config({ path: path.join(webRoot, ".env.local") });
  dotenv.config({ path: path.join(webRoot, ".env") });
} catch {
  /* optional */
}

async function downloadBrandPng(key: BrandKey): Promise<boolean> {
  const domain = BRAND_DOMAINS[key];
  const url = faviconUrlForDomain(domain);
  const dest = path.join(outDir, `${key}.png`);
  try {
    const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Zap/1.0" } });
    if (!res.ok) {
      console.warn(`  skip ${key}: HTTP ${res.status}`);
      return false;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 32) {
      console.warn(`  skip ${key}: response too small (${buf.length} bytes)`);
      return false;
    }
    fs.writeFileSync(dest, buf);
    console.log(`  saved ${key}.png (${buf.length} bytes) from ${domain}`);
    return true;
  } catch (e) {
    console.warn(`  skip ${key}:`, e instanceof Error ? e.message : e);
    return false;
  }
}

function copyMobileAssets(): void {
  if (!fs.existsSync(mobileDir)) return;
  for (const f of fs.readdirSync(mobileDir)) {
    if (!f.endsWith(".png")) continue;
    const src = path.join(mobileDir, f);
    const dest = path.join(outDir, f);
    fs.copyFileSync(src, dest);
    console.log(`  copied mobile/${f}`);
  }
}

async function updateCompanyLogos(client: pg.Client): Promise<number> {
  const r = await client.query<{ id: number; name: string | null; attributes: unknown }>(
    `SELECT id, name, attributes FROM companies ORDER BY id`
  );
  let updated = 0;
  for (const row of r.rows) {
    const name = row.name?.trim() ?? "";
    const key = name ? matchBrandKey(name) : null;
    if (!key) continue;
    const logoPath = localBrandLogoPath(key);
    const fullPath = path.join(outDir, `${key}.png`);
    if (!fs.existsSync(fullPath)) continue;

    const attrs =
      row.attributes && typeof row.attributes === "object" && !Array.isArray(row.attributes)
        ? { ...(row.attributes as Record<string, unknown>) }
        : {};
    if (attrs.logo_url === logoPath) continue;
    attrs.logo_url = logoPath;

    await client.query(`UPDATE companies SET attributes = $1::jsonb, updated_at = NOW() WHERE id = $2`, [
      JSON.stringify(attrs),
      row.id,
    ]);
    updated += 1;
    console.log(`  company ${row.id} ${name} → ${logoPath}`);
  }
  return updated;
}

async function main(): Promise<void> {
  fs.mkdirSync(outDir, { recursive: true });
  console.log("Copying existing mobile brand logos…");
  copyMobileAssets();

  console.log("Downloading favicons for all brand keys…");
  for (const key of BRAND_KEYS) {
    const dest = path.join(outDir, `${key}.png`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 200) {
      console.log(`  keep existing ${key}.png`);
      continue;
    }
    await downloadBrandPng(key);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("DATABASE_URL not set — skipped DB logo_url update.");
    return;
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    console.log("Updating companies.attributes.logo_url…");
    const n = await updateCompanyLogos(client);
    console.log(`Done. Updated ${n} companies.`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
