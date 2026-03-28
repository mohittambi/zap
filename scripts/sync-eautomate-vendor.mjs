#!/usr/bin/env node
/**
 * Fetches eautomate vendor + vendor-listings JSON and upserts into PostgreSQL
 * (warehouses, listings, bins, vendors, vendor_specialties, vendor_sku).
 *
 * Env: DATABASE_URL (required)
 *      EAUTOMATE_BASE_URL (optional, default https://web.eautomate.in)
 *      EAUTOMATE_COOKIE (optional; full Cookie header from browser — access_token + id_token)
 *      EAUTOMATE_BEARER_TOKEN (optional; alternative if API accepts Bearer auth)
 *
 * Usage: node scripts/sync-eautomate-vendor.mjs <vendorId>
 *        node scripts/sync-eautomate-vendor.mjs --file <dir>   # dir contains vendor.json + listings.json
 *    or: npm run sync:vendor -- <vendorId>
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import {
  executeVendorSync,
  num,
} from "./lib/eautomateVendorUpsert.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function eautomateFetchInit() {
  const headers = { Accept: "application/json" };
  const token = process.env.EAUTOMATE_BEARER_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const cookie = process.env.EAUTOMATE_COOKIE;
  if (cookie) headers.Cookie = cookie;
  return { headers };
}

async function fetchJson(url) {
  const res = await fetch(url, eautomateFetchInit());
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

function loadFromFixtureDir(dir) {
  const vendorPath = path.join(dir, "vendor.json");
  const listingsPath = path.join(dir, "listings.json");
  const vendor = JSON.parse(fs.readFileSync(vendorPath, "utf8"));
  const listingRows = JSON.parse(fs.readFileSync(listingsPath, "utf8"));
  if (!Array.isArray(listingRows)) {
    throw new Error(`${listingsPath}: expected a JSON array`);
  }
  return { vendor, listingRows };
}

async function main() {
  const dotenv = await import("dotenv");
  const webRoot = path.resolve(__dirname, "..");
  dotenv.config({ path: path.join(webRoot, ".env.local") });
  dotenv.config({ path: path.join(webRoot, ".env") });

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  let vendor;
  let listingRows;
  let vendorId;

  if (process.argv[2] === "--file") {
    const dir = path.resolve(process.cwd(), process.argv[3] || "");
    if (!dir || !fs.existsSync(dir)) {
      console.error("Usage: node scripts/sync-eautomate-vendor.mjs --file <dir>");
      process.exit(1);
    }
    ({ vendor, listingRows } = loadFromFixtureDir(dir));
    vendorId = num(vendor?.id);
    if (vendorId == null) {
      console.error("vendor.json must include numeric id");
      process.exit(1);
    }
    console.log("Loaded fixture from", dir);
  } else {
    vendorId = Number.parseInt(process.argv[2], 10);
    if (!vendorId) {
      console.error(
        "Usage: node scripts/sync-eautomate-vendor.mjs <vendorId>\n" +
          "       node scripts/sync-eautomate-vendor.mjs --file <dir>"
      );
      process.exit(1);
    }
    const base = (process.env.EAUTOMATE_BASE_URL || "https://web.eautomate.in").replace(/\/$/, "");
    const vendorUrl = `${base}/public/api/vendors/${vendorId}`;
    const listingsUrl = `${base}/public/api/vendors/listings/${vendorId}`;
    console.log("Fetching", vendorUrl);
    vendor = await fetchJson(vendorUrl);
    console.log("Fetching", listingsUrl);
    listingRows = await fetchJson(listingsUrl);
    if (!Array.isArray(listingRows)) {
      throw new Error("Expected array from vendor listings endpoint");
    }
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    await client.query("BEGIN");
    const stats = await executeVendorSync(client, vendor, listingRows);
    await client.query("COMMIT");
    console.log(
      `Done vendor ${vendorId}: warehouses=${stats.warehouseCount}, listing rows=${stats.listingRowCount}, specialties=${stats.specsCount}, skipped=${stats.skipped}`
    );
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
