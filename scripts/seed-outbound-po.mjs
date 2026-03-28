#!/usr/bin/env node
/**
 * Seeds companies (channel master), delivery locations, and outbound purchase orders.
 * Target: 3897 PO rows (matches demo API total), first page 100 rows.
 *
 * Optional: OUTBOUND_PO_PAGE1_JSON=path/to/export.json — must be { content: [...] } or full API response.
 *
 * Usage: node scripts/seed-outbound-po.mjs
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

const TARGET_TOTAL = 3897;
const PER_PAGE = 100;

const COMPANIES = [
  [30040, "Blinkit", "This is the company description."],
  [30054, "Pepperfry", "This is the company description."],
  [30055, "Flipkart Grocery", "This is the company description."],
  [30053, "Amazon Etrade - RK World", "This is the company description."],
  [30026, "Myntra", "This is the company description."],
  [30044, "Flipkart Minutes", "This is the company description."],
  [30052, "Flipkart Alpha", "This is the company description."],
  [30046, "Amazon Etrade", "This is the company description."],
  [30047, "Amazon FBA", "This is the company description."],
  [30048, "Swiggy", "This is the company description."],
  [30039, "Bigbasket", "This is the company description."],
  [30049, "Zepto", "This is the company description."],
  [30050, "Dmart", "This is the company description."],
  [30051, "Vaaree", "This is the company description."],
  [30056, "Amazon Etrade - VRP", "This is the company description."],
  [30057, "More Retail", "This is the company description."],
  [30058, "Slikk Club", "This is the company description."],
];

const DELIVERY_LOCATIONS = [
  "Jhajjar",
  "Coimbatore",
  "Farukhnagar",
  "Mumbai",
  "West Bengal",
  "Bangalore",
  "Gurgaon",
  "Chennai",
  "Kolkata",
  "Ahmedabad",
  "Bhiwandi",
  "Haryana",
  "Pune",
  "Punjab",
  "Lucknow",
  "New Delhi",
  "Noida",
  "Telangana",
  "Hyderabad",
  "Chandigarh",
  "Thane",
  "Kundli",
  "Jaipur",
  "Gujarat",
  "Jhajjar Gurgaon",
  "Thiruvallur",
  "Bengaluru",
  "Delhi",
  "Maharashtra",
  "Bhangore",
  "Utter Pradesh",
  "Sonipat",
  "Karnataka",
  "Gurugram",
  "Del5",
  "Ludhiana",
  "Ded5",
  "Kerala",
  "Kolkatta",
  "Guwahati",
  "Goa",
  "Andhra Pradesh",
  "Secunderabad",
  "Tamil Nadu",
  "Ded5  Gurugram",
  "Howrah",
  "Greater Noida",
  "Banglore",
  "Tripura",
  "Orissa",
  "Faridabad",
  "Patna",
  "Vizag",
  "Vijayawada",
  "Uttar Pradesh",
  "Vishakapatnam",
  "Rajpura",
  "Binola",
  "Kochi",
  "Hdl2",
  "Hka2",
  "Isk3",
  "Bangaluru",
  "Central Goa",
  "Guntur",
  "Hubli",
  "Cochin",
  "Del4",
  "Ded3",
  "Blr4",
  "Bom5",
  "Blr7",
  "Blr8",
  "Bom7",
  "Kolkattafmcgdc",
  "Tamilnadu",
  "Westbengal",
  "Maharastra",
  "Westebengal",
  "Hnr4",
  "Rajasthan",
  "Hba4",
  "Assam",
  "Up",
  "Ldx1",
  "Hyd3",
  "Cjb1",
  "Hyd8",
  "Maa4",
  "Pnq3",
  "Pax1",
  "Ded4",
  "Ccx1",
  "Gax1",
  "Ccx2",
  "Lko1",
];

/** Mulberry32 PRNG */
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadJson(p) {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadFirstPageRows() {
  const envPath = process.env.OUTBOUND_PO_PAGE1_JSON;
  const page1 = path.join(__dirname, "../seeds/fixtures/outbound_po_page1.json");
  const samples = path.join(__dirname, "../seeds/fixtures/outbound_po_samples.json");

  if (envPath && fs.existsSync(envPath)) {
    const j = loadJson(envPath);
    if (j?.content?.length) return j.content;
  }
  const j1 = loadJson(page1);
  if (j1?.content?.length) return j1.content;

  const samp = loadJson(samples);
  if (Array.isArray(samp) && samp.length) return expandFromSamples(samp);

  throw new Error(
    "No outbound PO fixture: add content[] to outbound_po_page1.json, or set OUTBOUND_PO_PAGE1_JSON, or keep outbound_po_samples.json"
  );
}

function expandFromSamples(samples) {
  const rnd = mulberry32(42);
  const companies = COMPANIES.map((c) => ({ id: c[0], name: c[1] }));
  const out = [];
  const base = samples[0];
  for (let i = 0; i < PER_PAGE; i++) {
    const co = companies[Math.floor(rnd() * companies.length)];
    const city = DELIVERY_LOCATIONS[Math.floor(rnd() * DELIVERY_LOCATIONS.length)];
    const skuCount = 1 + Math.floor(rnd() * 60);
    const demand = 50 + Math.floor(rnd() * 2000);
    const pending = Math.floor(demand * rnd());
    const dispatched = Math.floor((demand - pending) * rnd());
    const id = 4012 - i;
    const poNum =
      i === 0
        ? base.po_number
        : `${Math.floor(rnd() * 1e9)
            .toString(36)
            .toUpperCase()
            .slice(0, 8)}`;
    const wip = i === 0 ? base.is_wip : rnd() > 0.85 ? "YES" : "NO";
    const statusRoll = rnd();
    let calc = "ACKNOWLEDGEMENT PENDING";
    if (i === 0) calc = base.calculated_po_status;
    else if (wip === "YES" && statusRoll > 0.3) calc = "OPEN";
    else if (rnd() < 0.05) calc = "EXPIRED";

    const analytics =
      i === 0
        ? base.analytics_object
        : {
            sku_count: skuCount,
            total_demand: demand,
            total_before_tax: Math.round(100 * demand * (10 + rnd() * 200)) / 100,
            total_tax: Math.round(100 * demand * rnd() * 3) / 100,
            total_after_tax: Math.round(100 * demand * (15 + rnd() * 220)) / 100,
            total_pending: pending,
            total_dispatched: dispatched,
            boxes_dispatched: Math.floor(rnd() * 8),
            total_packed: Math.floor(rnd() * 500),
            boxes_packed: Math.floor(rnd() * 15),
            total_consignments: rnd() > 0.5 ? 1 : 0,
            sku_fill_rate: Math.round(rnd() * 100 * 100) / 100,
            quantity_fill_rate: Math.round(rnd() * 100 * 100) / 100,
          };

    out.push({
      ...base,
      id,
      company_id: i === 0 ? base.company_id : co.id,
      company_name: i === 0 ? base.company_name : co.name,
      po_number: poNum,
      delivery_city: i === 0 ? base.delivery_city : city,
      is_wip: wip,
      sold_via: "Eunoia",
      po_type: "Regular/BAU",
      po_creation_status: "COMPLETED",
      po_acknowledgement_status:
        i === 0
          ? base.po_acknowledgement_status
          : calc === "ACKNOWLEDGEMENT PENDING"
            ? "ACKNOWLEDGEMENT-PENDING"
            : "ACKNOWLEDGEMENT-COMPLETED",
      po_fulfillment_status:
        i === 0 ? base.po_fulfillment_status : calc === "OPEN" ? "FULFILLMENT-OPEN" : "NOT-SET",
      calculated_po_status: calc,
      analytics_object: analytics,
      created_at: i === 0 ? base.created_at : new Date(Date.now() - i * 3600_000).toISOString(),
      updated_at: i === 0 ? base.updated_at : new Date(Date.now() - i * 1800_000).toISOString(),
    });
  }
  return out;
}

function buildRemainingRows(startIndex, count, rnd) {
  const companies = COMPANIES.map((c) => ({ id: c[0], name: c[1] }));
  const rows = [];
  for (let k = 0; k < count; k++) {
    const i = startIndex + k;
    const co = companies[Math.floor(rnd() * companies.length)];
    const city = DELIVERY_LOCATIONS[Math.floor(rnd() * DELIVERY_LOCATIONS.length)];
    const skuCount = 1 + Math.floor(rnd() * 80);
    const demand = 40 + Math.floor(rnd() * 4000);
    const pending = Math.floor(demand * rnd());
    const dispatched = Math.floor((demand - pending) * rnd());
    const id = 3000000 + i;
    const poNum = `GEN-${String(i).padStart(6, "0")}`;
    const wip = rnd() > 0.88 ? "YES" : "NO";
    let calc = "ACKNOWLEDGEMENT PENDING";
    if (wip === "YES" && rnd() > 0.25) calc = "OPEN";
    if (rnd() < 0.04) calc = "EXPIRED";

    rows.push({
      id,
      sold_via: "Eunoia",
      company_id: co.id,
      po_number: poNum,
      delivery_city: city,
      delivery_address: `${co.name} — demo warehouse address`,
      billing_address: `${co.name} — demo billing address`,
      buyer_gstin: "29AAAAA0000A1Z5",
      po_issue_date: "2026-03-01 00:00:00",
      expiry_date: "2026-04-30 00:00:00",
      po_type: "Regular/BAU",
      po_creation_status: "COMPLETED",
      po_acknowledgement_status:
        calc === "ACKNOWLEDGEMENT PENDING" ? "ACKNOWLEDGEMENT-PENDING" : "ACKNOWLEDGEMENT-COMPLETED",
      po_fulfillment_status: calc === "OPEN" ? "FULFILLMENT-OPEN" : "NOT-SET",
      created_by: "ops.bhavna.saini",
      created_at: new Date(Date.now() - i * 7200_000).toISOString(),
      updated_at: new Date(Date.now() - i * 3600_000).toISOString(),
      is_wip: wip,
      remarks: "",
      company_name: co.name,
      analytics_object: {
        sku_count: skuCount,
        total_demand: demand,
        total_before_tax: Math.round(100 * demand * (8 + rnd() * 150)) / 100,
        total_tax: Math.round(100 * demand * rnd() * 2.5) / 100,
        total_after_tax: Math.round(100 * demand * (12 + rnd() * 160)) / 100,
        total_pending: pending,
        total_dispatched: dispatched,
        boxes_dispatched: Math.floor(rnd() * 10),
        total_packed: Math.floor(rnd() * 600),
        boxes_packed: Math.floor(rnd() * 18),
        total_consignments: rnd() > 0.55 ? 1 : 0,
        sku_fill_rate: Math.round(rnd() * 100 * 100) / 100,
        quantity_fill_rate: Math.round(rnd() * 100 * 100) / 100,
      },
      calculated_po_status: calc,
    });
  }
  return rows;
}

async function main() {
  requireLocalhost(process.env.DATABASE_URL);
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    for (const [id, name, desc] of COMPANIES) {
      await client.query(
        `INSERT INTO companies (id, name, attributes, is_active, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, 1, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           attributes = EXCLUDED.attributes,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()`,
        [id, name, JSON.stringify({ description: desc })]
      );
    }
    console.log(`Upserted ${COMPANIES.length} companies.`);

    for (const loc of DELIVERY_LOCATIONS) {
      await client.query(
        `INSERT INTO delivery_locations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
        [loc]
      );
    }
    console.log(`Inserted delivery locations (unique).`);

    let firstPage = loadFirstPageRows();
    if (firstPage.length > PER_PAGE) firstPage = firstPage.slice(0, PER_PAGE);
    const rnd = mulberry32(99);
    const needMore = Math.max(0, TARGET_TOTAL - firstPage.length);
    const extra = buildRemainingRows(0, needMore, rnd);
    const all = [...firstPage, ...extra];

    await client.query("DELETE FROM outbound_purchase_orders");

    const insertSql = `INSERT INTO outbound_purchase_orders (
      id, sold_via, company_id, po_number, delivery_city, delivery_address, billing_address,
      buyer_gstin, po_issue_date, expiry_date, po_type, po_creation_status,
      po_acknowledgement_status, po_fulfillment_status, created_by, created_at, updated_at,
      is_wip, remarks, company_name, analytics_object, calculated_po_status
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10::timestamptz,$11,$12,$13,$14,$15,$16::timestamptz,$17::timestamptz,
      $18,$19,$20,$21::jsonb,$22
    )`;

    for (const row of all) {
      await client.query(insertSql, [
        row.id,
        row.sold_via,
        row.company_id,
        row.po_number,
        row.delivery_city,
        row.delivery_address,
        row.billing_address,
        row.buyer_gstin,
        row.po_issue_date,
        row.expiry_date,
        row.po_type,
        row.po_creation_status,
        row.po_acknowledgement_status,
        row.po_fulfillment_status,
        row.created_by,
        row.created_at,
        row.updated_at,
        row.is_wip,
        row.remarks ?? "",
        row.company_name,
        JSON.stringify(row.analytics_object ?? {}),
        row.calculated_po_status,
      ]);
    }

    console.log(`Inserted ${all.length} outbound purchase orders (target ${TARGET_TOTAL}).`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
