import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildConsignmentLineSampleCsv,
  extractConsignmentLineDraftsFromListings,
  extractConsignmentSkuPackingFromListings,
  flattenSkuPackingToLineRows,
  groupLineRowsToSkuPacking,
  parseConsignmentLineCsv,
  parseConsignmentLineCsvToSkus,
  sumPackedQty,
  validateConsignmentSkuPackingClient,
  type ConsignmentSkuPacking,
} from "../../src/lib/outbound-consignment-line-drafts.ts";
import {
  mergeZapEanIntoRows,
  seedListingSkuFromEanMappings,
  type ZapEanLookup,
} from "../../src/server/services/eanMappingsService.ts";

const LISTINGS = {
  content: [
    {
      po_secondary_sku: "10153349",
      company_code_primary: "BAH501",
      inventory_sku_id: "INV-10153349",
      demand: 50,
      dispatched_quantity: 0,
      packed_quantity: 0,
    },
    {
      po_secondary_sku: "10149918",
      company_code_primary: "AAC500",
      inventory_sku_id: "INV-10149918",
      demand_quantity: 30,
      dispatched_quantity: 10,
    },
  ],
};

describe("extractConsignmentSkuPackingFromListings", () => {
  it("maps channel PO SKU, inventory SKU ID, and company code from PO listings", () => {
    const skus = extractConsignmentSkuPackingFromListings(LISTINGS);
    assert.equal(skus.length, 2);
    assert.equal(skus[0]?.po_secondary_sku, "10153349");
    assert.equal(skus[0]?.inventory_sku_id, "INV-10153349");
    assert.equal(skus[0]?.company_code_primary, "BAH501");
    assert.equal(skus[0]?.demand_quantity, 50);
    assert.equal(skus[0]?.pending_quantity, 50);
    assert.deepEqual(skus[0]?.boxes, []);
    assert.equal(skus[1]?.pending_quantity, 20);
  });

  it("uses master_sku for company code when company_code_primary matches channel SKU", () => {
    const skus = extractConsignmentSkuPackingFromListings({
      content: [
        {
          po_secondary_sku: "10160000",
          company_code_primary: "10160000",
          master_sku: "ZZZ100",
          inventory_sku_id: "INV-60000",
          demand: 10,
        },
      ],
    });
    assert.equal(skus[0]?.po_secondary_sku, "10160000");
    assert.equal(skus[0]?.inventory_sku_id, "INV-60000");
    assert.equal(skus[0]?.company_code_primary, "ZZZ100");
  });
});

/** Typical uploaded spreadsheet: company_code_primary copied from channel PO SKU. */
const SPREADSHEET_SNAPSHOT = {
  content: [
    { po_secondary_sku: "10149918", company_code_primary: "10149918", demand: 150 },
    { po_secondary_sku: "10153349", company_code_primary: "10153349", demand: 50 },
  ],
};

function formatSkuTable(skus: ConsignmentSkuPacking[]): string {
  const header = "po_secondary_sku\tcompany_code_primary";
  const rows = skus.map(
    (s) => `${s.po_secondary_sku}\t${s.company_code_primary}`
  );
  return [header, ...rows].join("\n");
}

describe("company code vs channel SKU (spreadsheet snapshot)", () => {
  it("raw extract without enrichment: company_code_primary must not echo channel sku", () => {
    const skus = extractConsignmentSkuPackingFromListings(SPREADSHEET_SNAPSHOT);
    console.log("\n[RAW extract — no EAN enrichment]\n");
    console.log(formatSkuTable(skus));
    assert.equal(skus[0]?.po_secondary_sku, "10149918");
    assert.equal(skus[0]?.company_code_primary, "");
    assert.notEqual(skus[0]?.company_code_primary, skus[0]?.po_secondary_sku);
  });

  it("EXPECTED: after EAN enrichment, company_code_primary is product master sku", () => {
    const eanBySkuKey = new Map<string, ZapEanLookup>([
      [
        "10149918",
        {
          sku_code: "AAC500",
          channel_ean: "10149918",
          universal_ean: "",
          ean_type: "ean",
        },
      ],
      [
        "10153349",
        {
          sku_code: "BAH501",
          channel_ean: "10153349",
          universal_ean: "",
          ean_type: "ean",
        },
      ],
    ]);
    const listingSkuByKey = new Map();
    seedListingSkuFromEanMappings(eanBySkuKey, listingSkuByKey);
    const enriched = mergeZapEanIntoRows(
      SPREADSHEET_SNAPSHOT.content as Record<string, unknown>[],
      eanBySkuKey,
      listingSkuByKey
    );
    const skus = extractConsignmentSkuPackingFromListings({ content: enriched });
    console.log("\n[ENRICHED extract — what consignment editor should show]\n");
    console.log(formatSkuTable(skus));
    assert.equal(skus[0]?.po_secondary_sku, "10149918");
    assert.equal(skus[0]?.company_code_primary, "AAC500");
    assert.notEqual(skus[0]?.company_code_primary, skus[0]?.po_secondary_sku);
    assert.equal(skus[1]?.po_secondary_sku, "10153349");
    assert.equal(skus[1]?.company_code_primary, "BAH501");
  });
});

describe("extractConsignmentLineDraftsFromListings", () => {
  it("returns flat rows (deprecated helper)", () => {
    const rows = extractConsignmentLineDraftsFromListings(LISTINGS);
    assert.equal(rows.length, 0);
  });
});

describe("flattenSkuPackingToLineRows / groupLineRowsToSkuPacking", () => {
  it("round-trips multiple boxes per SKU", () => {
    const template = extractConsignmentSkuPackingFromListings(LISTINGS);
    const withBoxes: ConsignmentSkuPacking[] = [
      {
        ...template[0]!,
        boxes: [
          { box_number: 1, box_quantity: 10, box_name: "Small Carton" },
          { box_number: 2, box_quantity: 15, box_name: "Small Carton" },
        ],
      },
      template[1]!,
    ];
    const flat = flattenSkuPackingToLineRows(withBoxes);
    assert.equal(flat.length, 2);
    assert.equal(flat[0]?.box_quantity, 10);
    assert.equal(flat[1]?.box_number, 2);

    const regrouped = groupLineRowsToSkuPacking(flat, template);
    assert.equal(regrouped.length, 2);
    assert.equal(regrouped[0]?.boxes.length, 2);
    assert.equal(regrouped[0]?.inventory_sku_id, "INV-10153349");
    assert.equal(sumPackedQty(regrouped[0]!), 25);
  });

  it("groups legacy saved rows where SKU was stored in company_code_primary", () => {
    const template = extractConsignmentSkuPackingFromListings(LISTINGS).slice(0, 1);
    const legacyFlat = [
      {
        po_secondary_sku: "BAH501",
        company_code_primary: "10153349",
        demand_quantity: 50,
        dispatched_quantity: 0,
        reserved_quantity: 0,
        pending_quantity: 50,
        box_number: 1,
        box_quantity: 5,
        box_name: "Small Carton",
      },
    ];
    const regrouped = groupLineRowsToSkuPacking(legacyFlat, template);
    assert.equal(regrouped[0]?.po_secondary_sku, "10153349");
    assert.equal(regrouped[0]?.inventory_sku_id, "INV-10153349");
    assert.equal(regrouped[0]?.company_code_primary, "BAH501");
    assert.equal(regrouped[0]?.boxes.length, 1);
  });
});

describe("validateConsignmentSkuPackingClient", () => {
  const validBins = new Set(["small carton"]);

  it("fails when packed total exceeds pending", () => {
    const sku: ConsignmentSkuPacking = {
      po_secondary_sku: "10153349",
      inventory_sku_id: "INV-10153349",
      company_code_primary: "BAH501",
      demand_quantity: 50,
      dispatched_quantity: 0,
      reserved_quantity: 0,
      pending_quantity: 20,
      boxes: [{ box_number: 1, box_quantity: 25, box_name: "Small Carton" }],
    };
    const r = validateConsignmentSkuPackingClient([sku], validBins);
    assert.equal(r.ok, false);
    assert.match(r.errors[0]?.message ?? "", /exceeds pending/);
  });

  it("passes when packed total is within pending", () => {
    const sku: ConsignmentSkuPacking = {
      po_secondary_sku: "10153349",
      inventory_sku_id: "INV-10153349",
      company_code_primary: "BAH501",
      demand_quantity: 50,
      dispatched_quantity: 0,
      reserved_quantity: 0,
      pending_quantity: 20,
      boxes: [{ box_number: 1, box_quantity: 20, box_name: "Small Carton" }],
    };
    const r = validateConsignmentSkuPackingClient([sku], validBins);
    assert.equal(r.ok, true);
  });
});

describe("buildConsignmentLineSampleCsv", () => {
  it("includes all nine headers and placeholder row when boxes empty", () => {
    const skus = extractConsignmentSkuPackingFromListings(LISTINGS).slice(0, 1);
    const csv = buildConsignmentLineSampleCsv(skus);
    const lines = csv.trim().split("\n");
    assert.ok(lines[0]?.includes("po_secondary_sku"));
    assert.ok(lines[0]?.includes("box_name"));
    assert.ok(lines[1]?.startsWith("10153349"));
  });
});

describe("parseConsignmentLineCsv", () => {
  it("parses tab-separated upload", () => {
    const tsv =
      "po_secondary_sku\tcompany_code_primary\tdemand_quantity\tdispatched_quantity\treserved_quantity\tpending_quantity\tbox_number\tbox_quantity\tbox_name\n" +
      "10153349\tBAH501\t50\t0\t0\t50\t1\t10\tSmall Carton\n";
    const { rows, errors } = parseConsignmentLineCsv(tsv);
    assert.equal(errors.length, 0);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.po_secondary_sku, "10153349");
    assert.equal(rows[0]?.company_code_primary, "BAH501");
    assert.equal(rows[0]?.box_quantity, 10);
    assert.equal(rows[0]?.box_name, "Small Carton");
  });
});

describe("parseConsignmentLineCsvToSkus", () => {
  it("groups multiple rows for the same SKU", () => {
    const template = extractConsignmentSkuPackingFromListings(LISTINGS);
    const tsv =
      "po_secondary_sku\tcompany_code_primary\tdemand_quantity\tdispatched_quantity\treserved_quantity\tpending_quantity\tbox_number\tbox_quantity\tbox_name\n" +
      "10153349\tBAH501\t50\t0\t0\t50\t1\t10\tSmall Carton\n" +
      "10153349\tBAH501\t50\t0\t0\t50\t2\t15\tSmall Carton\n";
    const { skus, errors } = parseConsignmentLineCsvToSkus(tsv, template);
    assert.equal(errors.length, 0);
    assert.equal(skus[0]?.boxes.length, 2);
    assert.equal(skus[0]?.inventory_sku_id, "INV-10153349");
    assert.equal(sumPackedQty(skus[0]!), 25);
  });
});
