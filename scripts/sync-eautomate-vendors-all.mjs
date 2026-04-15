#!/usr/bin/env node
/**
 * GET eautomate /public/api/vendors/all and upsert every row into vendors.
 *
 * Env: DATABASE_URL (required)
 *      EAUTOMATE_BASE_URL (optional, default https://web.eautomate.in)
 *      EAUTOMATE_COOKIE / EAUTOMATE_BEARER_TOKEN (same as other eautomate sync scripts)
 *      EAUTOMATE_LOGIN_USER_ID + EAUTOMATE_LOGIN_PASSWORD (optional; POST /public/api/login on 401 / cold start)
 *
 * Usage: node scripts/sync-eautomate-vendors-all.mjs
 *        node scripts/sync-eautomate-vendors-all.mjs --file path/to/vendors-all.json
 *    or: npm run sync:vendors:all
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { fetchEautomate } from "./lib/eautomateAuthFetch.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  const dotenv = await import("dotenv");
  const root = path.join(__dirname, "..");
  dotenv.default.config({ path: path.join(root, ".env.local") });
  dotenv.default.config({ path: path.join(root, ".env") });
} catch {
  /* optional */
}

function parseTimestamptz(value) {
  if (value == null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  if (y < 1 || y > 9999) return null;
  return d.toISOString();
}

function num(v, fallback = null) {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function fetchVendorsAllJson(base) {
  const url = `${base.replace(/\/$/, "")}/public/api/vendors/all`;
  const res = await fetchEautomate(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let hint = "";
    if (
      res.status === 401 &&
      !process.env.EAUTOMATE_BEARER_TOKEN &&
      !process.env.EAUTOMATE_COOKIE
    ) {
      hint =
        " (set EAUTOMATE_COOKIE or EAUTOMATE_BEARER_TOKEN if the API requires auth)";
    }
    throw new Error(`HTTP ${res.status} ${url}${hint}${text ? ` — ${text.slice(0, 200)}` : ""}`);
  }
  return res.json();
}

function extractVendorRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.vendors)) return data.vendors;
  throw new Error(
    "Unexpected /vendors/all JSON: expected a top-level array or { content | data | vendors: array }"
  );
}

/** Flatten common eautomate / wrapper shapes; align keys with sync-eautomate-vendor.mjs upsertVendor. */
function normalizeVendor(raw) {
  if (raw == null || typeof raw !== "object") return null;
  const v = raw.vendor && typeof raw.vendor === "object" ? { ...raw.vendor, ...raw } : { ...raw };
  const id = num(v.id, null);
  if (id == null) return null;
  return {
    id,
    vendor_name:
      v.vendor_name != null
        ? String(v.vendor_name)
        : v.name != null
          ? String(v.name)
          : null,
    created_by: v.created_by != null ? String(v.created_by) : null,
    modified_by: v.modified_by != null ? String(v.modified_by) : null,
    created_at: parseTimestamptz(v.created_at),
    updated_at: parseTimestamptz(v.updated_at),
    vendor_address_line:
      v.vendor_address_line != null
        ? String(v.vendor_address_line)
        : v.address != null
          ? String(v.address)
          : v.vendor_address != null
            ? String(v.vendor_address)
            : null,
    vendor_city: v.vendor_city != null ? String(v.vendor_city) : null,
    vendor_state: v.vendor_state != null ? String(v.vendor_state) : null,
    vendor_postal_code:
      v.vendor_postal_code != null
        ? String(v.vendor_postal_code)
        : v.pin_code != null
          ? String(v.pin_code)
          : v.postal_code != null
            ? String(v.postal_code)
            : null,
    vendor_gstin: v.vendor_gstin != null ? String(v.vendor_gstin) : null,
    vendor_contact_number:
      v.vendor_contact_number != null
        ? String(v.vendor_contact_number)
        : v.contact_number != null
          ? String(v.contact_number)
          : v.phone != null
            ? String(v.phone)
            : null,
  };
}

async function upsertVendor(client, v) {
  await client.query(
    `INSERT INTO vendors (
      id, vendor_name, created_by, modified_by, created_at, updated_at,
      vendor_address_line, vendor_city, vendor_state, vendor_postal_code,
      vendor_gstin, vendor_contact_number
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT (id) DO UPDATE SET
      vendor_name = EXCLUDED.vendor_name,
      created_by = EXCLUDED.created_by,
      modified_by = EXCLUDED.modified_by,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at,
      vendor_address_line = EXCLUDED.vendor_address_line,
      vendor_city = EXCLUDED.vendor_city,
      vendor_state = EXCLUDED.vendor_state,
      vendor_postal_code = EXCLUDED.vendor_postal_code,
      vendor_gstin = EXCLUDED.vendor_gstin,
      vendor_contact_number = EXCLUDED.vendor_contact_number`,
    [
      v.id,
      v.vendor_name != null ? String(v.vendor_name).slice(0, 200) : null,
      v.created_by != null ? String(v.created_by).slice(0, 100) : null,
      v.modified_by != null ? String(v.modified_by).slice(0, 100) : null,
      v.created_at,
      v.updated_at,
      v.vendor_address_line,
      v.vendor_city != null ? String(v.vendor_city).slice(0, 100) : null,
      v.vendor_state != null ? String(v.vendor_state).slice(0, 100) : null,
      v.vendor_postal_code != null ? String(v.vendor_postal_code).slice(0, 20) : null,
      v.vendor_gstin != null ? String(v.vendor_gstin).slice(0, 50) : null,
      v.vendor_contact_number != null ? String(v.vendor_contact_number).slice(0, 50) : null,
    ]
  );
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  if (/YOUR_USERNAME|YOUR_PASSWORD/i.test(dbUrl)) {
    console.error(
      "DATABASE_URL still uses a placeholder (YOUR_USERNAME or YOUR_PASSWORD). Fix .env.local."
    );
    process.exit(1);
  }

  const argv = process.argv.slice(2);
  let filePath;
  if (argv[0] === "--file" && argv[1]) {
    filePath = path.resolve(argv[1]);
  } else if (argv.length > 0) {
    console.error("Usage: node scripts/sync-eautomate-vendors-all.mjs [--file path.json]");
    process.exit(1);
  }

  let data;
  if (filePath) {
    data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    console.log(`Loaded JSON from ${path.basename(filePath)}`);
  } else {
    const base = (process.env.EAUTOMATE_BASE_URL || "https://web.eautomate.in").replace(
      /\/$/,
      ""
    );
    console.log(`GET ${base}/public/api/vendors/all …`);
    data = await fetchVendorsAllJson(base);
  }

  const rows = extractVendorRows(data);
  console.log(`Parsed ${rows.length} vendor record(s)`);

  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  let n = 0;
  let skipped = 0;
  try {
    await client.query("BEGIN");
    for (const raw of rows) {
      const v = normalizeVendor(raw);
      if (!v) {
        skipped += 1;
        continue;
      }
      await upsertVendor(client, v);
      n += 1;
    }
    await client.query("COMMIT");
    const tail = skipped > 0 ? `; skipped ${skipped} row(s) without id` : "";
    console.log(`Upserted ${n} vendor row(s)${tail}`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
