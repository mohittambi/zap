/**
 * Pure helpers shared by inbound PO list and GRN pending-queue pages.
 * Kept out of React components for unit testing.
 */

const listDateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const expiryDayFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatInboundListDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return listDateTimeFormatter.format(d);
}

/** Format YYYY-MM-DD (or ISO datetime) as date-only for inbound queue tables. */
export function formatInboundListDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  const dateOnly = isoDate.trim().slice(0, 10);
  const d = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return expiryDayFormatter.format(d);
}

export function statusToneClass(value: string | null): string {
  if (!value) return "";
  const up = value.trim().toUpperCase();
  if (up === "APPROVED" || up === "DONE" || up === "COMPLETED") {
    return "text-violet-600 dark:text-violet-400 font-medium";
  }
  if (up === "REJECTED") {
    return "text-destructive font-medium";
  }
  return "";
}

/** Matches pagination footer on inbound list pages: at least one page. */
export function inboundPaginatedTotalPages(
  total: number,
  perPageCount: number
): number {
  if (total > 0 && perPageCount > 0) {
    return Math.ceil(total / perPageCount);
  }
  return 1;
}

export function buildInboundPurchaseOrdersQuery(opts: {
  page: number;
  count: number;
  searchKeyword: string;
  vendorIds?: readonly number[];
  poIdFilter?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}): string {
  const q = new URLSearchParams({
    page: String(opts.page),
    count: String(opts.count),
    search_keyword: opts.searchKeyword,
  });
  if (opts.vendorIds && opts.vendorIds.length > 0) {
    q.set("vendor_ids", [...opts.vendorIds].sort((a, b) => a - b).join(","));
  }
  const po = opts.poIdFilter?.trim();
  if (po) q.set("po_id_filter", po);
  if (opts.sortBy && opts.sortDir) {
    q.set("sort_by", opts.sortBy);
    q.set("sort_dir", opts.sortDir);
  }
  return q.toString();
}

export function buildPendingGrnsListQuery(opts: {
  page: number;
  count: number;
  searchKeyword: string;
}): string {
  const q = new URLSearchParams({
    page: String(opts.page),
    count: String(opts.count),
    search_keyword: opts.searchKeyword,
  });
  return q.toString();
}

export function parseExpectedDateOnly(s: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (!m) return null;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    12,
    0,
    0,
    0
  );
}

/**
 * Expiry: today … today+5 (inclusive) = "soon"; before today = expired; after = ok.
 * @param referenceDate optional anchor for tests (defaults to current time).
 */
export function expiryTone(
  expected: string | null,
  referenceDate: Date = new Date()
): "expired" | "soon" | "ok" | "unknown" {
  const d = parseExpectedDateOnly(expected);
  if (!d || Number.isNaN(d.getTime())) return "unknown";
  const startToday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const lastSoonDay = new Date(startToday);
  lastSoonDay.setDate(lastSoonDay.getDate() + 5);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const t0 = startToday.getTime();
  const t1 = lastSoonDay.getTime();
  if (day < t0) return "expired";
  if (day <= t1) return "soon";
  return "ok";
}

export function formatExpiryDateDisplay(raw: string | null): string {
  const d = parseExpectedDateOnly(raw);
  if (!d || Number.isNaN(d.getTime())) return raw ?? "—";
  return expiryDayFormatter.format(d);
}

export function displayPoStatus(status: string | null): string {
  if (!status) return "—";
  if (status === "PENDING_PUBLISHED") return "Published";
  if (status === "MARKED_CANCELLED") return "Cancelled";
  if (status === "MARKED_MODIFICATION") return "Modification";
  return status.replaceAll("_", " ");
}

export type InboundPoCsvRow = {
  po_id: number;
  vendor_id: number;
  vendor_name: string | null;
  expected_date: string | null;
  status: string | null;
  sku_count: number;
  total_quantity: number;
  number_of_grns: number;
  sku_fill_rate: number;
  quantity_fill_rate: number;
  po_remarks: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export function inboundPoRowsToCsv(rows: readonly InboundPoCsvRow[]): string {
  const headers = [
    "po_id",
    "vendor_id",
    "vendor_name",
    "expected_date",
    "status",
    "sku_count",
    "total_quantity",
    "number_of_grns",
    "sku_fill_rate",
    "quantity_fill_rate",
    "po_remarks",
    "created_at",
    "updated_at",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.po_id,
        row.vendor_id,
        row.vendor_name,
        row.expected_date,
        row.status,
        row.sku_count,
        row.total_quantity,
        row.number_of_grns,
        row.sku_fill_rate,
        row.quantity_fill_rate,
        row.po_remarks,
        row.created_at,
        row.updated_at,
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return lines.join("\n");
}
