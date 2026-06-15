import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildConsignmentLineSampleCsv,
  extractConsignmentLineDraftsFromListings,
  applyBulkFormRowsToSkus,
  extractConsignmentSkuPackingFromListings,
  validateConsignmentSkuPackingClient,
  flattenSkuPackingToLineRows,
  getMaxBoxNumber,
  countDistinctBoxNumbers,
  countDistinctBoxNumbersForSku,
  formatSkuBoxBreakdown,
  formatSkuBoxNames,
  formatSkuBoxNumbers,
  formatSkuBoxQuantities,
  hasPackedLinesOnBox,
  groupLineRowsToSkuPacking,
  skusToBulkFormRows,
  parseConsignmentLineCsv,
  parseConsignmentLineCsvToSkus,
  sumPackedQty,
  upsertSkuBoxLine,
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

describe("box count and breakdown helpers", () => {
  it("countDistinctBoxNumbers counts physical boxes with qty > 0", () => {
    const template = extractConsignmentSkuPackingFromListings(LISTINGS);
    const skus: ConsignmentSkuPacking[] = [
      {
        ...template[0]!,
        boxes: [
          { box_number: 1, box_quantity: 5, box_name: "Small Carton" },
          { box_number: 3, box_quantity: 10, box_name: "Large" },
        ],
      },
      {
        ...template[1]!,
        boxes: [{ box_number: 1, box_quantity: 2, box_name: "Small Carton" }],
      },
    ];
    assert.equal(countDistinctBoxNumbers(skus), 2);
    assert.equal(countDistinctBoxNumbersForSku(skus[0]!), 2);
    assert.equal(
      formatSkuBoxBreakdown(skus[0]!),
      "1:5 Small Carton, 3:10 Large"
    );
  });

  it("ignores zero-qty lines in box counts", () => {
    const template = extractConsignmentSkuPackingFromListings(LISTINGS).slice(0, 1);
    const sku: ConsignmentSkuPacking = {
      ...template[0]!,
      boxes: [
        { box_number: 1, box_quantity: 0, box_name: "Small Carton" },
        { box_number: 2, box_quantity: 3, box_name: "Small Carton" },
      ],
    };
    assert.equal(countDistinctBoxNumbers([sku]), 1);
    assert.equal(countDistinctBoxNumbersForSku(sku), 1);
    assert.equal(formatSkuBoxBreakdown(sku), "2:3 Small Carton");
  });

  it("formatSkuBoxNumbers/Quantities/Names for one box per SKU (client pattern)", () => {
    const template = extractConsignmentSkuPackingFromListings(LISTINGS).slice(0, 1);
    const sku: ConsignmentSkuPacking = {
      ...template[0]!,
      boxes: [{ box_number: 3, box_quantity: 18, box_name: "MASTER_BOX_3" }],
    };
    assert.equal(formatSkuBoxNumbers(sku), "3");
    assert.equal(formatSkuBoxQuantities(sku), "18");
    assert.equal(formatSkuBoxNames(sku), "MASTER_BOX_3");
  });

  it("formatSkuBoxNumbers/Quantities/Names for multi-box SKU", () => {
    const template = extractConsignmentSkuPackingFromListings(LISTINGS).slice(0, 1);
    const sku: ConsignmentSkuPacking = {
      ...template[0]!,
      boxes: [
        { box_number: 1, box_quantity: 10, box_name: "MASTER_BOX_3" },
        { box_number: 3, box_quantity: 15, box_name: "MASTER_BOX_3" },
      ],
    };
    assert.equal(formatSkuBoxNumbers(sku), "1, 3");
    assert.equal(formatSkuBoxQuantities(sku), "10, 15");
    assert.equal(formatSkuBoxNames(sku), "MASTER_BOX_3, MASTER_BOX_3");
  });

  it("formatSkuBoxNumbers/Quantities/Names return empty for no packed boxes", () => {
    const template = extractConsignmentSkuPackingFromListings(LISTINGS).slice(0, 1);
    const sku: ConsignmentSkuPacking = { ...template[0]!, boxes: [] };
    assert.equal(formatSkuBoxNumbers(sku), "");
    assert.equal(formatSkuBoxQuantities(sku), "");
    assert.equal(formatSkuBoxNames(sku), "");
  });
});

describe("consignment-wide box helpers", () => {
  it("getMaxBoxNumber returns highest box across SKUs", () => {
    const template = extractConsignmentSkuPackingFromListings(LISTINGS);
    const skus: ConsignmentSkuPacking[] = [
      {
        ...template[0]!,
        boxes: [{ box_number: 1, box_quantity: 10, box_name: "Small Carton" }],
      },
      {
        ...template[1]!,
        boxes: [{ box_number: 3, box_quantity: 5, box_name: "Small Carton" }],
      },
    ];
    assert.equal(getMaxBoxNumber(skus), 3);
    assert.equal(getMaxBoxNumber([]), 0);
  });

  it("upsertSkuBoxLine merges qty for same box number and name", () => {
    const template = extractConsignmentSkuPackingFromListings(LISTINGS).slice(0, 1);
    const sku = template[0]!;
    const once = upsertSkuBoxLine(sku, {
      box_number: 1,
      box_name: "Small Carton",
      box_quantity: 10,
    });
    assert.equal(once.boxes.length, 1);
    assert.equal(once.boxes[0]?.box_quantity, 10);

    const twice = upsertSkuBoxLine(once, {
      box_number: 1,
      box_name: "Small Carton",
      box_quantity: 15,
    });
    assert.equal(twice.boxes.length, 1);
    assert.equal(twice.boxes[0]?.box_quantity, 15);
  });

  it("two SKUs on box 1 flatten to one distinct box number", () => {
    const template = extractConsignmentSkuPackingFromListings(LISTINGS);
    const skus: ConsignmentSkuPacking[] = [
      upsertSkuBoxLine(template[0]!, {
        box_number: 1,
        box_name: "Small Carton",
        box_quantity: 10,
      }),
      upsertSkuBoxLine(template[1]!, {
        box_number: 1,
        box_name: "Small Carton",
        box_quantity: 20,
      }),
    ];
    assert.equal(getMaxBoxNumber(skus), 1);
    const flat = flattenSkuPackingToLineRows(skus);
    assert.equal(flat.length, 2);
    assert.equal(flat[0]?.box_number, 1);
    assert.equal(flat[1]?.box_number, 1);
    const distinct = new Set(flat.map((r) => r.box_number));
    assert.equal(distinct.size, 1);
  });

  it("hasPackedLinesOnBox detects lines on a box number", () => {
    const template = extractConsignmentSkuPackingFromListings(LISTINGS).slice(0, 1);
    const packed = upsertSkuBoxLine(template[0]!, {
      box_number: 2,
      box_name: "Small Carton",
      box_quantity: 5,
    });
    assert.equal(hasPackedLinesOnBox([packed], 2), true);
    assert.equal(hasPackedLinesOnBox([packed], 1), false);
  });

  it("applyBulkFormRowsToSkus uses activeBoxNumber when open box is shared across SKUs", () => {
    const template = extractConsignmentSkuPackingFromListings(LISTINGS);
    const { skus, errors } = applyBulkFormRowsToSkus(
      [
        {
          id: "1",
          po_secondary_sku: "10153349",
          company_code_primary: "BAH501",
          box_number: "",
          box_name: "Small Carton",
          box_quantity: "10",
          removable: false,
        },
        {
          id: "2",
          po_secondary_sku: "10149918",
          company_code_primary: "AAC500",
          box_number: "",
          box_name: "Small Carton",
          box_quantity: "5",
          removable: false,
        },
      ],
      template,
      { activeBoxNumber: 1, assignSequentialWhenEmpty: false }
    );
    assert.equal(errors.length, 0);
    assert.equal(skus[0]?.boxes[0]?.box_number, 1);
    assert.equal(skus[1]?.boxes[0]?.box_number, 1);
    assert.equal(getMaxBoxNumber(skus), 1);
  });

  it("applyBulkFormRowsToSkus assigns sequential box numbers when not sharing an open box", () => {
    const template = extractConsignmentSkuPackingFromListings(LISTINGS);
    const { skus, errors } = applyBulkFormRowsToSkus(
      [
        {
          id: "1",
          po_secondary_sku: "10153349",
          company_code_primary: "BAH501",
          box_number: "",
          box_name: "MASTER_BOX_3",
          box_quantity: "10",
          removable: false,
        },
        {
          id: "2",
          po_secondary_sku: "10149918",
          company_code_primary: "AAC500",
          box_number: "",
          box_name: "MASTER_BOX_3",
          box_quantity: "5",
          removable: false,
        },
      ],
      template,
      { assignSequentialWhenEmpty: true }
    );
    assert.equal(errors.length, 0);
    assert.equal(skus[0]?.boxes[0]?.box_number, 1);
    assert.equal(skus[1]?.boxes[0]?.box_number, 2);
  });
});

describe("bulk form helpers", () => {
  it("skusToBulkFormRows returns one row per PO SKU with sequential default box numbers", () => {
    const template = extractConsignmentSkuPackingFromListings(LISTINGS);
    const rows = skusToBulkFormRows(template, { defaultBoxNumber: 4 });
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.po_secondary_sku, "10153349");
    assert.equal(rows[0]?.box_number, "4");
    assert.equal(rows[1]?.po_secondary_sku, "10149918");
    assert.equal(rows[1]?.box_number, "5");
  });

  it("applyBulkFormRowsToSkus uses explicit box_number from bulk rows", () => {
    const template = extractConsignmentSkuPackingFromListings(LISTINGS).slice(0, 1);
    const { skus, errors } = applyBulkFormRowsToSkus(
      [
        {
          id: "1",
          po_secondary_sku: "10153349",
          company_code_primary: "BAH501",
          box_number: "1",
          box_name: "Small Carton",
          box_quantity: "5",
          removable: false,
        },
        {
          id: "2",
          po_secondary_sku: "10153349",
          company_code_primary: "BAH501",
          box_number: "3",
          box_name: "Small Carton",
          box_quantity: "10",
          removable: true,
        },
      ],
      template
    );
    assert.equal(errors.length, 0);
    assert.equal(skus[0]?.boxes.length, 2);
    assert.equal(skus[0]?.boxes[0]?.box_number, 1);
    assert.equal(skus[0]?.boxes[1]?.box_number, 3);
  });

  it("applyBulkFormRowsToSkus groups multiple box lines per SKU", () => {
    const template = extractConsignmentSkuPackingFromListings(LISTINGS);
    const { skus, errors } = applyBulkFormRowsToSkus(
      [
        {
          id: "1",
          po_secondary_sku: "10149918",
          company_code_primary: "AAC500",
          box_number: "",
          box_name: "Small Carton",
          box_quantity: "10",
          removable: false,
        },
        {
          id: "2",
          po_secondary_sku: "10149918",
          company_code_primary: "AAC500",
          box_number: "",
          box_name: "Small Carton",
          box_quantity: "10",
          removable: true,
        },
        {
          id: "3",
          po_secondary_sku: "10153349",
          company_code_primary: "BAH501",
          box_number: "",
          box_name: "Small Carton",
          box_quantity: "50",
          removable: false,
        },
      ],
      template
    );
    assert.equal(errors.length, 0);
    const a = skus.find((s) => s.po_secondary_sku === "10149918");
    assert.equal(a?.boxes.length, 2);
    assert.equal(sumPackedQty(a!), 20);
  });

  it("applyBulkFormRowsToSkus rejects when packed total exceeds pending", () => {
    const template = extractConsignmentSkuPackingFromListings(LISTINGS);
    const formRows = [
      {
        id: "1",
        po_secondary_sku: "10149918",
        company_code_primary: "AAC500",
        box_number: "1",
        box_name: "Small Carton",
        box_quantity: "15",
        removable: false,
      },
      {
        id: "2",
        po_secondary_sku: "10149918",
        company_code_primary: "AAC500",
        box_number: "2",
        box_name: "Small Carton",
        box_quantity: "10",
        removable: true,
      },
    ];
    const { skus, errors } = applyBulkFormRowsToSkus(formRows, template);
    assert.equal(errors.length, 0);
    const a = skus.find((s) => s.po_secondary_sku === "10149918");
    assert.equal(a?.boxes.length, 2);
    const validBins = new Set(["small carton"]);
    const v = validateConsignmentSkuPackingClient(skus, validBins);
    assert.equal(v.ok, false);
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
    assert.ok(lines[0]?.includes(","));
    assert.ok(!lines[0]?.includes("\t"));
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

  it("accepts Excel-style truncated header aliases", () => {
    const csv =
      "po_secondary_sku,company_code_primary,demand_quantity,dispatched_quantity,reserved_quantity,pending_q,box_num,box_quan,box_name\n" +
      "10153349,BAH501,50,0,0,50,3,50,MASTER_BOX_3\n";
    const { rows, errors } = parseConsignmentLineCsv(csv);
    assert.equal(errors.length, 0, errors.join("; "));
    assert.equal(rows[0]?.box_number, 3);
    assert.equal(rows[0]?.box_quantity, 50);
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
