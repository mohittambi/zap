#!/usr/bin/env node
/**
 * Seeds standard catalogues + listings for local catalogue builder demo.
 * Safe for localhost DATABASE_URL only.
 *
 * Usage: node scripts/seed-catalogue-demo.mjs
 * Optional: CATALOGUE_LISTINGS_JSON=path/to/listings.json (array of listing objects)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function requireLocalhost(url) {
  if (!url || (!url.includes("localhost") && !url.includes("127.0.0.1"))) {
    console.error("Refusing: DATABASE_URL must point to localhost.");
    process.exit(1);
  }
}

const CATALOGUES = [
  [19084, "standard", "ecipl", "sample", "admin.ankit.agarwal", "2026-03-21T03:18:27Z"],
  [19083, "standard", "cerm", "cerm", "ops.bhavna.saini", "2026-03-17T11:19:43Z"],
  [19082, "standard", "WMDFWH", "WMDFWH", "ops.bhavna.saini", "2026-03-13T08:38:56Z"],
  [18825, "standard", "Event 1", "Table props , candles and many more", "saumya.agarwal", "2024-11-05T05:54:00Z"],
  [18822, "standard", "Event Props", "TABLE TOPPERS", "saumya.agarwal", "2024-11-05T03:39:25Z"],
  [18601, "standard", "Catalogue Wooden Clocks", "Contains all wooden clocks", "akshit.goyal", "2024-05-26T02:17:59Z"],
  [18325, "standard", "Wall Cutouts", "Wall Cutouts", "akshit.goyal", "2000-01-01T00:00:00Z"],
  [18324, "standard", "Polyresin Idols", "Polyresin Idols", "akshit.goyal", "2000-01-01T00:00:00Z"],
  [18323, "standard", "Krishna Wall Hanging", "Krishna Wall Hanging", "akshit.goyal", "2000-01-01T00:00:00Z"],
  [18322, "standard", "Metal Ganesha Wall Hanging", "Metal Ganesha Wall Hanging", "akshit.goyal", "2000-01-01T00:00:00Z"],
  [18321, "standard", "Religious wall décor", "Religious wall décor", "akshit.goyal", "2000-01-01T00:00:00Z"],
  [18320, "standard", "Human Figurine", "Human Figurine", "akshit.goyal", "2000-01-01T00:00:00Z"],
  [18319, "standard", "Planter", "Planter", "akshit.goyal", "2000-01-01T00:00:00Z"],
  [18318, "standard", "Collage Photoframe", "Collage Photoframe", "akshit.goyal", "2000-01-01T00:00:00Z"],
  [18317, "standard", "Photoframe", "Photoframe", "akshit.goyal", "2000-01-01T00:00:00Z"],
  [18316, "standard", "Paintings", "Paintings", "akshit.goyal", "2000-01-01T00:00:00Z"],
  [18315, "standard", "Organiser MultiPurpose", "Organiser MultiPurpose", "akshit.goyal", "2000-01-01T00:00:00Z"],
  [18314, "standard", "Natural Essential Oil", "Contains natural essential oil", "akshit.goyal", "2000-01-01T00:00:00Z"],
  [18313, "standard", "Mugs", "Contains all mugs", "akshit.goyal", "2000-01-01T00:00:00Z"],
  [18312, "standard", "Lamp with Showpiece", "Contains lamps with showpiece", "akshit.goyal", "2000-01-01T00:00:00Z"],
  [18311, "standard", "Lamp", "Conatins lamps", "akshit.goyal", "2000-01-01T00:00:00Z"],
  [18310, "standard", "Key Holders with utility", "Contains Key Holders with utility", "akshit.goyal", "2000-01-01T00:00:00Z"],
  [18309, "standard", "Key Holders", "Contains all key holders", "akshit.goyal", "2000-01-01T00:00:00Z"],
  [18308, "standard", "Dream Catchers", "Contains dream catchers", "akshit.goyal", "2000-01-01T00:00:00Z"],
  [18307, "standard", "Door Hanging Bandarwal", "Contains bandarwal", "akshit.goyal", "2000-01-01T00:00:00Z"],
  [18306, "standard", "Diyas", "Contains Diyas", "akshit.goyal", "2000-01-01T00:00:00Z"],
  [18305, "standard", "Candle Stand", "Contains Candle Stand", "akshit.goyal", "2000-01-01T00:00:00Z"],
  [18304, "standard", "Candles Catalogue", "Contains all candles", "akshit.goyal", "2000-01-01T00:00:00Z"],
];

/** @returns {object[]} */
function loadListingRows() {
  const p = process.env.CATALOGUE_LISTINGS_JSON;
  const defaultPath = path.join(__dirname, "../seeds/fixtures/catalogue_demo_listings.json");
  const file = p && fs.existsSync(p) ? p : defaultPath;
  if (!fs.existsSync(file)) {
    console.warn("No listings JSON found; generating 231 placeholder SKUs.");
    return [];
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  if (Array.isArray(raw)) return raw;
  if (raw.content && Array.isArray(raw.content)) return raw.content;
  if (raw.listings && Array.isArray(raw.listings)) return raw.listings;
  return [];
}

function buildPlaceholderListings(targetTotal, existing) {
  const have = new Set(existing.map((r) => r.sku_id));
  const out = [...existing];
  let n = 1;
  let nextId =
    existing.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
  const baseImg = "http://tech.intellozene.com/Media/MSGB498_main_hd.jpg";
  while (out.length < targetTotal) {
    const sku = `ZAP-DEMO-${String(n).padStart(5, "0")}`;
    n += 1;
    if (have.has(sku)) continue;
    have.add(sku);
    const id = nextId++;
    out.push({
      id,
      sku_id: sku,
      master_sku: sku,
      inventory_sku_id: sku,
      pack_combo_sku_id: "NA",
      sku_type: "SINGLE",
      inventory_bypass_on: "NO",
      ops_tag: "SM",
      category: "Showpiece - Idols and Figurines",
      description: `Demo listing ${sku}`,
      meta_fields: "NA",
      img_hd: baseImg,
      img_white: baseImg,
      img_wdim: baseImg,
      img_link1: "",
      img_link2: "",
      no_of_constituents: 1,
      actual_weight: 0,
      dimension: "10Cm x 10Cm x 10Cm",
      bulk_price: 199,
      keyword_pool: "Demo keyword pool",
      material_info: "Resin",
      available_quantity: 10,
      created_at: "2000-01-01T00:00:00.000000Z",
      updated_at: "2000-01-01T00:00:00.000000Z",
    });
  }
  return out.slice(0, targetTotal);
}

async function upsertListing(client, row) {
  const inv = row.inventory_bypass_on ?? "NO";
  const rawCreated = row.created_at ? new Date(row.created_at).toISOString() : null;
  const rawUpdated = row.updated_at ? new Date(row.updated_at).toISOString() : null;
  await client.query(
    `INSERT INTO listings (
      id, sku_id, master_sku, inventory_sku_id, pack_combo_sku_id, sku_type,
      inventory_bypass_on, ops_tag, category, description, meta_fields,
      img_hd, img_white, img_wdim, img_link1, img_link2, no_of_constituents,
      actual_weight, dimension, bulk_price, keyword_pool, material_info,
      available_quantity, raw_created_at, raw_updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
    )
    ON CONFLICT (sku_id) DO UPDATE SET
      description = EXCLUDED.description,
      img_hd = EXCLUDED.img_hd,
      available_quantity = EXCLUDED.available_quantity,
      bulk_price = EXCLUDED.bulk_price,
      updated_at = NOW()`,
    [
      Number(row.id),
      row.sku_id,
      row.master_sku ?? row.sku_id,
      row.inventory_sku_id ?? row.sku_id,
      row.pack_combo_sku_id ?? "NA",
      row.sku_type ?? "SINGLE",
      inv,
      row.ops_tag ?? "SM",
      row.category ?? "",
      row.description ?? "",
      row.meta_fields ?? "",
      row.img_hd ?? "",
      row.img_white ?? "",
      row.img_wdim ?? "",
      row.img_link1 ?? "",
      row.img_link2 ?? "",
      row.no_of_constituents ?? 1,
      row.actual_weight ?? 0,
      row.dimension ?? "",
      row.bulk_price ?? 0,
      row.keyword_pool ?? "",
      row.material_info ?? "",
      row.available_quantity ?? 0,
      rawCreated,
      rawUpdated,
    ]
  );
}

async function main() {
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local" });
  dotenv.config();
  const url = process.env.DATABASE_URL;
  requireLocalhost(url);

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    await client.query("BEGIN");

    for (const row of CATALOGUES) {
      const [id, ctype, name, desc, createdBy, ts] = row;
      await client.query(
        `INSERT INTO catalogues (id, catalogue_type, name, description, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$6::timestamptz)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           created_by = EXCLUDED.created_by,
           updated_at = NOW()`,
        [id, ctype, name, desc, createdBy, ts]
      );
    }

    let listingRows = loadListingRows();
    const TARGET = Number(process.env.CATALOGUE_DEMO_LISTING_TOTAL || 231);
    listingRows = buildPlaceholderListings(TARGET, listingRows);

    for (const row of listingRows) {
      await upsertListing(client, row);
    }

    const demoCatId = 19084;
    const sidebarSkus = ["MSGB498", "MSGB499", "MSGB500", "MSGB501", "MSGB502", "MSGB503", "MSGB504", "MSGB505"];
    let order = 0;
    for (const sku of sidebarSkus) {
      const exists = await client.query(`SELECT 1 FROM listings WHERE sku_id = $1`, [sku]);
      if (exists.rowCount) {
        order += 1;
        await client.query(
          `INSERT INTO catalogue_items (catalogue_id, sku_id, sort_order)
           VALUES ($1,$2,$3)
           ON CONFLICT (catalogue_id, sku_id) DO NOTHING`,
          [demoCatId, sku, order]
        );
      }
    }

    await client.query(
      `SELECT setval(pg_get_serial_sequence('catalogues','id'), (SELECT COALESCE(MAX(id),1) FROM catalogues))`
    );

    await client.query("COMMIT");
    console.log(
      `OK: ${CATALOGUES.length} catalogues, ${listingRows.length} listings, sample items on catalogue ${demoCatId}.`
    );
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
