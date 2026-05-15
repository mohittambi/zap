/**
 * Unit tests for the deepMergeListing and related helpers in
 * sync-eautomate-secondary-listings.mjs.
 *
 * These cover the core gap: when eAutomate POST returns empty/null for fields
 * that the paginated GET already resolved, we must not lose GET data.
 */
import { describe, it } from "node:test";
import assert from "node:assert";

// ---- inline the pure helpers under test (mirrors the sync script) ----

function isVacuousScalar(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  return false;
}

function deepMergeListing(getRow, postPayload) {
  const a = getRow && typeof getRow === "object" ? { ...getRow } : {};
  const b = postPayload && typeof postPayload === "object" ? { ...postPayload } : {};
  const merged = { ...a, ...b };

  const scalarKeys = [
    "pack_combo_sku_id",
    "master_sku",
    "inventory_sku_id",
    "secondary_sku",
    "sku_type",
    "id",
    "ais_quantity",
    "inventory_bypass_status",
    "available_quantity",
  ];
  for (const key of scalarKeys) {
    if (!isVacuousScalar(merged[key])) continue;
    const gv = a[key];
    if (!isVacuousScalar(gv)) merged[key] = gv;
  }

  const gCo = Array.isArray(a.secondary_sku_company_details) ? a.secondary_sku_company_details : [];
  const mCo = Array.isArray(merged.secondary_sku_company_details)
    ? merged.secondary_sku_company_details
    : [];
  if (mCo.length === 0 && gCo.length > 0) merged.secondary_sku_company_details = gCo;

  const gl =
    a.secondary_sku_labels_data &&
    typeof a.secondary_sku_labels_data === "object" &&
    !Array.isArray(a.secondary_sku_labels_data)
      ? a.secondary_sku_labels_data
      : {};
  const ml =
    merged.secondary_sku_labels_data &&
    typeof merged.secondary_sku_labels_data === "object" &&
    !Array.isArray(merged.secondary_sku_labels_data)
      ? merged.secondary_sku_labels_data
      : {};
  const mlEmpty = Object.keys(ml).length === 0;
  merged.secondary_sku_labels_data =
    mlEmpty && Object.keys(gl).length > 0 ? { ...gl } : { ...gl, ...ml };

  return merged;
}

// ---- tests ----

describe("deepMergeListing — pack_combo_sku_id preservation", () => {
  it("keeps GET pack_combo_sku_id when POST returns null", () => {
    const getRow = { id: 1208, secondary_sku: "D1001P6C6MSGB527W1", pack_combo_sku_id: "D1001P6C6MSGB527", sku_type: "MULTI" };
    const postPayload = { pack_combo_sku_id: null, secondary_sku_listing: null };
    const merged = deepMergeListing(getRow, postPayload);
    assert.strictEqual(merged.pack_combo_sku_id, "D1001P6C6MSGB527");
  });

  it("keeps GET pack_combo_sku_id when POST returns empty string", () => {
    const getRow = { id: 22, secondary_sku: "AAT505_A", pack_combo_sku_id: "AAT505", sku_type: "MULTI" };
    const postPayload = { pack_combo_sku_id: "" };
    const merged = deepMergeListing(getRow, postPayload);
    assert.strictEqual(merged.pack_combo_sku_id, "AAT505");
  });

  it("uses POST pack_combo_sku_id when it's a real value", () => {
    const getRow = { id: 22, secondary_sku: "AAT505_A", pack_combo_sku_id: "AAT505_OLD" };
    const postPayload = { pack_combo_sku_id: "AAT505_NEW" };
    const merged = deepMergeListing(getRow, postPayload);
    assert.strictEqual(merged.pack_combo_sku_id, "AAT505_NEW");
  });
});

describe("deepMergeListing — company_details preservation", () => {
  it("keeps GET companies when POST returns empty array", () => {
    const companies = [{ company_id: 30044, company_name: "Flipkart Minutes" }];
    const getRow = { id: 1208, secondary_sku_company_details: companies };
    const postPayload = { secondary_sku_company_details: [] };
    const merged = deepMergeListing(getRow, postPayload);
    assert.deepStrictEqual(merged.secondary_sku_company_details, companies);
  });

  it("uses POST companies when POST has entries", () => {
    const getCompanies = [{ company_id: 30044, company_name: "Flipkart Minutes" }];
    const postCompanies = [{ company_id: 30052, company_name: "Flipkart Alpha" }];
    const getRow = { id: 1208, secondary_sku_company_details: getCompanies };
    const postPayload = { secondary_sku_company_details: postCompanies };
    const merged = deepMergeListing(getRow, postPayload);
    assert.deepStrictEqual(merged.secondary_sku_company_details, postCompanies);
  });
});

describe("deepMergeListing — labels_data preservation", () => {
  it("keeps GET labels when POST returns empty object", () => {
    const labels = { mrp: 1199, material: "Assorted", one_set_contains: "1 Rakhi" };
    const getRow = { id: 1208, secondary_sku_labels_data: labels };
    const postPayload = { secondary_sku_labels_data: {} };
    const merged = deepMergeListing(getRow, postPayload);
    assert.strictEqual(merged.secondary_sku_labels_data.mrp, 1199);
    assert.strictEqual(merged.secondary_sku_labels_data.material, "Assorted");
  });

  it("merges labels when POST adds extra keys", () => {
    const getRow = { id: 1208, secondary_sku_labels_data: { mrp: 1199 } };
    const postPayload = { secondary_sku_labels_data: { ean_code: "ABC123" } };
    const merged = deepMergeListing(getRow, postPayload);
    assert.strictEqual(merged.secondary_sku_labels_data.mrp, 1199);
    assert.strictEqual(merged.secondary_sku_labels_data.ean_code, "ABC123");
  });

  it("POST labels override GET labels for same keys", () => {
    const getRow = { id: 1208, secondary_sku_labels_data: { mrp: 1199 } };
    const postPayload = { secondary_sku_labels_data: { mrp: 999 } };
    const merged = deepMergeListing(getRow, postPayload);
    assert.strictEqual(merged.secondary_sku_labels_data.mrp, 999);
  });
});

describe("deepMergeListing — sku_type preservation", () => {
  it("keeps GET sku_type when POST omits it", () => {
    const getRow = { id: 1208, secondary_sku: "D1001P6C6MSGB527W1", sku_type: "MULTI" };
    const postPayload = {};
    const merged = deepMergeListing(getRow, postPayload);
    assert.strictEqual(merged.sku_type, "MULTI");
  });
});
