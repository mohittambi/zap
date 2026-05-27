import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  groupPackingRowsByBin,
  parseConsignmentPackingSpreadsheet,
  userFacingField,
} from "../../src/server/utils/outboundConsignmentPackingSpreadsheetParse";

const sampleCsvPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../public/samples/outbound/sample_consignment_packing.csv"
);

describe("parseConsignmentPackingSpreadsheet", () => {
  it("parses public sample CSV with Bin Number and Bin Name headers", () => {
    const buf = fs.readFileSync(sampleCsvPath);
    const { rows, errors } = parseConsignmentPackingSpreadsheet(
      buf,
      "sample_consignment_packing.csv"
    );
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(rows.length, 3);
    assert.strictEqual(rows[0].box_number, 1);
    assert.strictEqual(rows[0].box_name, "Small Carton");
    assert.strictEqual(rows[0].po_secondary_sku, "10149864");
    assert.strictEqual(rows[0].quantity, 10);
    assert.strictEqual(rows[0].company_code_primary, "AAC500");
    assert.strictEqual(rows[0].company_code_secondary, "8906176480245");
  });

  it("accepts legacy Box Number / Box Name headers", () => {
    const csv = [
      "Box Number,Box Name,Item Code,Quantity",
      "1,Small Carton,10149864,5",
    ].join("\n");
    const { rows, errors } = parseConsignmentPackingSpreadsheet(
      Buffer.from(csv, "utf8"),
      "legacy.csv"
    );
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].box_number, 1);
    assert.strictEqual(rows[0].box_name, "Small Carton");
  });

  it("reports missing required headers with bin field labels", () => {
    const csv = ["Item Code,Quantity", "10149864,5"].join("\n");
    const { rows, errors } = parseConsignmentPackingSpreadsheet(
      Buffer.from(csv, "utf8"),
      "bad.csv"
    );
    assert.strictEqual(rows.length, 0);
    assert.ok(errors.some((e) => e.message.includes("Bin Number")));
    assert.ok(errors.some((e) => e.message.includes("Bin Name")));
  });

  it("reports invalid row values", () => {
    const csv = [
      "Bin Number,Bin Name,Item Code,Quantity",
      ",Small Carton,10149864,5",
    ].join("\n");
    const { rows, errors } = parseConsignmentPackingSpreadsheet(
      Buffer.from(csv, "utf8"),
      "invalid-row.csv"
    );
    assert.strictEqual(rows.length, 0);
    assert.ok(
      errors.some(
        (e) =>
          e.field === userFacingField("box_number") &&
          e.message.includes("Bin Number")
      )
    );
  });

  it("groups rows by bin", () => {
    const csv = [
      "Bin Number,Bin Name,Item Code,Quantity",
      "1,Small Carton,10149864,10",
      "1,Small Carton,10146920,5",
      "2,Medium Carton,10149864,20",
    ].join("\n");
    const { rows } = parseConsignmentPackingSpreadsheet(
      Buffer.from(csv, "utf8"),
      "group.csv"
    );
    const grouped = groupPackingRowsByBin(rows);
    assert.strictEqual(grouped.length, 2);
    assert.strictEqual(grouped[0].items.length, 2);
    assert.strictEqual(grouped[1].box_number, 2);
  });
});
