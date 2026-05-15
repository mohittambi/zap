"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { MermaidDiagram } from "@/components/ui/mermaid";
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ── Inbound (existing) flows ────────────────────────────────────────────────

const GRN_LIFECYCLE = `
flowchart TD
    PO["Inbound PO in Zap
(created in Zap or carried over
from historical import)"] --> GRN_OPEN

    GRN_OPEN["GRN Opened
grn_status = OPEN
Source: Zap Postgres"] --> QTY_UPDATE

    QTY_UPDATE["Quantity Update
invoice qty / accepted / rejected / shortage
Source: GRN line snapshot in Postgres"] --> DN_SHORT{Shortage or
Damage?}

    DN_SHORT -->|Yes| DN_SHORTAGE["GRN Debit / Credit Note
shortage / damage / vendor adjustment
See GRN DCN flow"]
    DN_SHORT -->|No| CLOSE_GRN

    DN_SHORTAGE --> CLOSE_GRN

    CLOSE_GRN["Close GRN action in Zap UI
grn_status = CLOSED
closed_by / closed_at recorded"] --> INV_UPLOAD

    INV_UPLOAD["Invoice Upload
JPG / JPEG / PDF
Action: Zap file upload"] --> PENDING_AUDIT

    PENDING_AUDIT["Pending Audit Queue
inbound_grn_pending_audit
Source: Zap DB queue"] --> AUDIT_ACTION

    AUDIT_ACTION["Audit completed
grn_audit_status = CLOSED
Action: Audit team in Zap"] --> DN_RATE{Rate
Discrepancy?}

    DN_RATE -->|No — prices match| INV_COLLECT
    DN_RATE -->|Yes — vendor overcharged| DN_ZAP["Zap Debit Note generated
status = DRAFT
See Zap Debit Note flow"]

    DN_ZAP --> INV_COLLECT

    INV_COLLECT["Physical Invoice Copy Received
grn_invoice_collection_status = COLLECTED
Pending Invoice Collection queue"] --> ACCOUNTS

    ACCOUNTS["Accounts Review
Action: Accounts team in Zap
Download Invoice Excel available"] --> ACCT_DECISION{Decision}

    ACCT_DECISION -->|Approved| ACCT_APPROVED["accounts_status = APPROVED"]
    ACCT_DECISION -->|Rejected| ACCT_REJECTED["accounts_status = REJECTED
Reason recorded"]

    ACCT_REJECTED -->|Vendor corrects invoice| INV_COLLECT

    ACCT_APPROVED --> INV_RECEIPT

    INV_RECEIPT["Inventory Receipt
Map SKU to Bin to Qty
inventory_receipt_status = DONE"]
`;

const ZAP_DEBIT_NOTE = `
flowchart TD
    AUDIT_CLOSE["Audit closed
Rate discrepancy detected"] --> GEN_BTN["Accounts clicks Generate Debit Note"]

    GEN_BTN --> DRAFT["status = DRAFT
reference = DN-GRN-id-YYYYMMDD
auto-generated in Zap"]

    DRAFT --> DN_ASSIGN["Accounts assigns real DN Number
PATCH debit-note with dn_number"] --> ISSUED["status = ISSUED"]
    DRAFT --> TALLY_EXPORT["Tally CSV downloaded"] --> EXPORTED_D["status = EXPORTED"]

    EXPORTED_D --> DN_ASSIGN2["Accounts assigns DN Number"] --> ISSUED
    ISSUED --> TALLY_EXPORT2["Tally CSV downloaded"] --> EXPORTED_I["status = EXPORTED"]

    ISSUED --> CN_UPLOAD["Vendor uploads CN Copy PDF
POST debit-note/cn-copy"] --> CLOSED["status = CLOSED"]
    EXPORTED_I --> CN_UPLOAD
    EXPORTED_D --> CN_UPLOAD
`;

const ZAP_DN_STATE = `
stateDiagram-v2
    [*] --> DRAFT : Generate debit note
    DRAFT --> ISSUED : Assign DN number
    DRAFT --> EXPORTED : Export Tally CSV
    EXPORTED --> ISSUED : Assign DN number
    ISSUED --> EXPORTED : Export Tally CSV
    ISSUED --> CLOSED : Upload CN copy
    EXPORTED --> CLOSED : Upload CN copy
`;

const GRN_DCN = `
flowchart TD
    GRN_INGEST["GRN details available in Zap
(historically imported or
captured at GRN time)"] --> NOTE_EXISTS{DCN exists
on this GRN?}

    NOTE_EXISTS -->|No — no shortage or damage| END_NONE["No DCN — GRN proceeds normally"]
    NOTE_EXISTS -->|Yes| NOTE_TYPE{Note Type}

    NOTE_TYPE -->|Debit Note| DN_EA["DEBIT_NOTE
shortage / damage — vendor owes money to Zap"]
    NOTE_TYPE -->|Credit Note| CN_EA["CREDIT_NOTE
vendor overpayment — Zap owes vendor"]

    DN_EA --> NUM_ASSIGN{Number
Assigned?}
    CN_EA --> NUM_ASSIGN

    NUM_ASSIGN -->|No| PENDING_DC["Pending Debit and Credit Queue
assignment_status = NOT_ASSIGNED"]
    NUM_ASSIGN -->|Yes| NUM_ASSIGNED["Number set
assignment_status = ASSIGNED"]

    PENDING_DC -->|Number received from vendor| NUM_ASSIGNED

    NUM_ASSIGNED --> UPLOAD{File
Uploaded?}

    UPLOAD -->|No| NOT_UPLOADED["upload_status = NOT_UPLOADED"]
    UPLOAD -->|Yes| UPLOADED["upload_status = UPLOADED
uploaded_by set"]

    NOT_UPLOADED -->|Upload in Zap| UPLOADED

    UPLOADED --> REVERSE{Reverse
Note needed?}
    REVERSE -->|Yes — dispute or correction| REV_NOTE["Reverse note number recorded
Reverse copy uploaded"]
    REVERSE -->|No — settled as-is| SETTLED["Settled"]
    REV_NOTE --> SETTLED
`;

const INVOICE_COLLECT_FLOW = `
flowchart TD
    AUDIT_DONE["Audit closed
grn_audit_status = CLOSED"] --> DN_DONE{Zap Debit Note
if any}

    DN_DONE -->|DN present — wait for resolution| DN_PROGRESS["DN in progress
DRAFT / ISSUED / EXPORTED"]
    DN_DONE -->|No DN or DN CLOSED| PENDING_COL["Physical Invoice Collection
grn_invoice_collection_status = PENDING"]

    DN_PROGRESS -->|DN CLOSED — CN copy received| PENDING_COL

    PENDING_COL --> COL_ACTION["Accounts team marks collected
Action: Pending Invoice Collection queue"] --> COLLECTED["grn_invoice_collection_status = COLLECTED
Excel download unlocked"]

    COLLECTED --> ACCT_REVIEW["Accounts Approval queue
accounts_status = PENDING"]

    ACCT_REVIEW --> ACCT_DEC{Approved or
Rejected?}
    ACCT_DEC -->|Approved| APPROVED["accounts_status = APPROVED
GRN cleared for Inventory Receipt"]
    ACCT_DEC -->|Rejected| REJECTED["accounts_status = REJECTED
Reason noted"]

    REJECTED -->|Re-submit after correction| ACCT_REVIEW
    APPROVED --> INV_RECEIPT["Inventory Receipt
Map SKU to Bin to Qty
inventory_receipt_status = DONE"]
`;

// ── Outbound flows ──────────────────────────────────────────────────────────

const OUTBOUND_PO_LIFECYCLE = `
flowchart TD
    SYNC["Outbound PO present in Zap
(created in Zap or carried over
from historical import)"] --> NEW["Status: NEW
appears on /outbound list"]

    NEW --> ACK["Ops clicks Acknowledge
POST /outbound/purchase-orders/:id/actions
action=acknowledge"]

    ACK --> WIP_DECISION{Mark WIP?}
    WIP_DECISION -->|YES via save_field| WIP["is_wip = YES
appears on /outbound/wip"]
    WIP_DECISION -->|NO| OPEN["Stays in /outbound only"]

    WIP --> CONS["Create consignment
POST /consignments
persists outbound_consignments
in Zap Postgres"]

    CONS --> DISPATCH["Mark dispatched
outbound_consignments updated
appears on /outbound/consignments"]

    DISPATCH --> INV_PEND["Pending Invoice
appears on /outbound/pending-invoices
until vendor invoice received"]

    INV_PEND --> CLOSED["PO fulfilled
analytics_object updated by sync"]

    NEW --> CANCEL_PATH["Ops clicks Cancel
calculated_po_status = CANCELLED"]
    ACK --> CANCEL_PATH
    WIP --> CANCEL_PATH
`;

const OUTBOUND_PARTIAL_RECOVERY = `
flowchart TD
    NEW_PO["Operator opens
/outbound/new"] --> FORM["Fill PO form
+ upload PDF + spreadsheet
(2 files, 2MB each)"]

    FORM --> SUBMIT{All required
fields valid?}
    SUBMIT -->|No| ERROR["Stays on form
inline error"]
    SUBMIT -->|Yes| ROW["INSERT outbound_purchase_orders
po_creation_status = PARTIAL
files saved to uploads/outbound-po/{id}/"]

    ROW --> PARTIAL_LIST["Appears on
/outbound/partial"]

    PARTIAL_LIST --> RESUME["Operator opens partial PO
fills missing details
(line items from spreadsheet)"]

    RESUME --> COMPLETE{Complete?}
    COMPLETE -->|No| PARTIAL_LIST
    COMPLETE -->|Yes| FULL["po_creation_status = FULL
moves to /outbound list
ready for Acknowledge"]
`;

const OUTBOUND_CONSIGNMENT_DISPATCH = `
flowchart TD
    PO_WIP["PO is_wip = YES
required to start consignment"] --> NEW_CONS["POST /consignments
handled by Zap backend"]

    NEW_CONS --> EA_CREATE{Zap backend
accepts payload?}
    EA_CREATE -->|No| FAIL["Validation / error
surfaced to UI
no consignment row created"]
    EA_CREATE -->|Yes| UPSERT["UPSERT outbound_consignments
in Zap Postgres"]

    UPSERT --> PICK["Warehouse picks SKUs
into numbered boxes"]

    PICK --> LABELS["Generate labels
POST /outbound/purchase-orders/:id/actions
action=generate_phase1_box_labels
or generate_product_labels"]

    LABELS --> PRINT["Print + apply labels
on physical boxes"]

    PRINT --> DISPATCH_MARK["Ops marks Dispatched
in /outbound/consignments
or /outbound/boxes"]

    DISPATCH_MARK --> CONSIGNMENT_DONE["Status updated
boxes_dispatched incremented
in analytics_object"]

    CONSIGNMENT_DONE --> NEXT_SYNC["Next sync:outbound-po-detail
refreshes listings_snapshot
+ outbound_po_logs"]
`;

const OUTBOUND_PENDING_INVOICE = `
flowchart TD
    DISPATCHED["Consignment dispatched
goods en-route or delivered"] --> ON_QUEUE["Appears on
/outbound/pending-invoices
keyed by consignment / PO"]

    ON_QUEUE --> CHASE["Ops chases vendor
for invoice copy"]

    CHASE --> RECEIVED{Invoice
received?}
    RECEIVED -->|No| ON_QUEUE
    RECEIVED -->|Yes| UPLOAD["Upload to consignment
or PO record
(Zap Storage)"]

    UPLOAD --> RECONCILE["Match against
ordered + dispatched qty
+ rates"]

    RECONCILE --> OK{Match
clean?}
    OK -->|Yes| CLEARED["Removed from
pending-invoices queue"]
    OK -->|No — short ship| SHORT["Raise debit / credit
note upstream"]
    SHORT --> CLEARED
`;

// ── Listings flows ──────────────────────────────────────────────────────────

const LISTINGS_WAREHOUSE_CREATE = `
flowchart TD
    SOURCE{Source}
    SOURCE -->|Manual entry| FORM["Operator opens
/listings/warehouse
+ adds new listing"]
    SOURCE -->|Import| BULK["Bulk Operations:
upload spreadsheet
to /listings/bulk"]
    SOURCE -->|Historical import| SYNC["Legacy import scripts
seeded secondary_listings
(one-time backfill)"]

    FORM --> ROW["INSERT listings
or update existing
+ link to vendor + bin"]
    BULK --> VALIDATE{Schema
valid?}
    VALIDATE -->|No| BULK_ERR["Errors per row
on bulk-result page"]
    VALIDATE -->|Yes| ROW
    SYNC --> ENRICH["Enrichment JSONB persisted
in secondary listings table"]

    ROW --> AVAILABLE["Listing visible in
/listings/warehouse grid
+ catalogue / labels"]
    ENRICH --> AVAILABLE
`;

const LISTINGS_BULK_OPERATIONS = `
flowchart TD
    UPLOAD["Operator uploads
spreadsheet on
/listings/bulk"] --> PARSE["Server parses
template detection +
column mapping"]

    PARSE --> CHECK{Per-row
validation}
    CHECK -->|Errors| ERR_REPORT["Error report rows
operator fixes file"]
    CHECK -->|All clean| BATCH["Batch INSERT/UPDATE
in transaction"]

    ERR_REPORT --> UPLOAD

    BATCH --> RESULT["Result page:
N created / M updated
download diff CSV"]

    RESULT --> AUDIT["Operation logged
with user + timestamp"]
`;

const LISTINGS_PACKS_COMBOS = `
flowchart TD
    BASE["Base SKUs exist
in listings"] --> PACK_FORM["Open
/listings/packs-combos
+ define pack
(parent SKU + child SKUs + qty)"]

    PACK_FORM --> SAVE["Save pack
inserts pack_combo
+ pack_combo_lines"]

    SAVE --> AVAILABLE["Pack SKU available in
catalogue + outbound POs
qty derived from
component availability"]

    AVAILABLE --> ORDER_USE["When ordered, packs
auto-explode into
component reservations
in inventory"]
`;

const LISTINGS_LABELS_MASTER = `
flowchart TD
    SKU["SKU exists
in listings"] --> LABEL_FORM["Open
/listings/labels-master
+ enter label fields
(MRP, mfg, FSSAI, etc.)"]

    LABEL_FORM --> SAVE["Insert / update
labels_master_data"]

    SAVE --> READY["Label data available
to Phase-1 box labels +
generate_product_labels"]

    READY --> PRINT["Outbound action
generates PDF
ready for printing"]
`;

const LISTINGS_FOCUS_LIST = `
flowchart TD
    OPS["Ops curates
priority SKUs"] --> ADD["Add SKUs to
/listings/focus
(focus list table)"]

    ADD --> WHY["Reason captured
campaign / season / launch
+ owner"]

    WHY --> WATCH["Focus list visible
across home dashboard
+ inbound + outbound views"]

    WATCH --> REVIEW["Periodic review
remove or refresh
items as priorities shift"]
`;

// ── Inventory flows ─────────────────────────────────────────────────────────

const INVENTORY_GRN_INFLOW = `
flowchart TD
    GRN_RECEIPT["GRN inventory_receipt_status
= DONE
(post-audit + accounts approval)"] --> MAP["Operator maps
SKU → bin → qty"]

    MAP --> WRITE["INSERT/UPDATE
warehouse_inventory_log
+ bin-level rows"]

    WRITE --> AVAIL["available_quantity
on listings updated"]

    AVAIL --> VIEWS["Visible in:
/listings/warehouse
/inventory/sku-wise
home Inventory Snapshot KPI"]
`;

const INVENTORY_DISPATCH_DECREMENT = `
flowchart TD
    PACK["Consignment packed
and dispatched"] --> CHECK["Each line:
sku × qty × bin"]

    CHECK --> DECREMENT["UPDATE listings
available_quantity -= qty
+ bin row decremented"]

    DECREMENT --> LOG["Append warehouse_inventory_log
operation = DISPATCH
linked to consignment_id"]

    LOG --> ALERT{Below reorder
threshold?}
    ALERT -->|Yes| REORDER["SKU appears in
home Reorder Alerts
+ /reorder page"]
    ALERT -->|No| DONE["Stock state stable"]
`;

const INVENTORY_PACKS_SECONDARY = `
flowchart TD
    PACK_REQ["Order needs
pack SKU qty"] --> RESOLVE["Pack lookup:
parent → child SKUs"]

    RESOLVE --> CHILD_AVAIL{Child SKUs
available?}
    CHILD_AVAIL -->|All in stock| RESERVE["Reserve children
inventory/packs"]
    CHILD_AVAIL -->|Short| SHORT["Pack flagged short
appears in Reorder Alerts
for the bottleneck child"]

    RESERVE --> DISPATCH_PACK["Pack dispatched
each child decremented
in inventory/secondary"]

    DISPATCH_PACK --> UPDATE["inventory/sku-wise
shows updated state for all
involved children"]
`;

const INVENTORY_RECONCILIATION = `
flowchart TD
    COUNT["Warehouse physical count
SKU × bin"] --> SHEET["Operator enters into
Bulk Ops template"]

    SHEET --> UPLOAD["Upload to
/listings/bulk
(reconciliation template)"]

    UPLOAD --> COMPARE["Server compares
counted vs system qty"]

    COMPARE --> DELTA{Discrepancies?}
    DELTA -->|None| CLEAN["Reconciliation report
filed; nothing to fix"]
    DELTA -->|Yes| FLAG["Flagged rows
shown for investigation"]

    FLAG --> INVESTIGATE["Identify cause:
unlisted dispatch / damage /
counting error"]

    INVESTIGATE --> ADJUST["Apply adjustments
warehouse_inventory_log
operation = ADJUSTMENT
reason captured"]

    ADJUST --> AUDIT_FILE["Final reconciliation
report + adjustments
filed for audit"]
`;

// ── Business workflows (mirror docs/business/workflows/end-to-end-flows.md) ──

const BIZ_INBOUND = `
flowchart LR
  subgraph Procurement
    P1[Raise PO in Zap]
  end
  subgraph Vendor
    V1[Confirm + ship goods]
  end
  subgraph Warehouse
    W1[Receive goods]
    W2[Create GRN<br/>enter quantities]
  end
  subgraph Finance
    F1[Match invoice<br/>to GRN]
    F2[Approve OR<br/>raise debit note]
  end
  P1 --> V1 --> W1 --> W2 --> F1 --> F2
`;

const BIZ_OUTBOUND = `
flowchart LR
  subgraph Channel
    C1[Place PO]
  end
  subgraph Ops
    O1[Acknowledge]
    O2[Generate labels<br/>+ pendency report]
  end
  subgraph Warehouse
    WH1[Pick + pack]
    WH2[Print + apply labels]
  end
  subgraph Logistics
    L1[Hand off to transport]
    L2[Mark dispatched]
  end
  C1 --> O1 --> WH1 --> O2 --> WH2 --> L1 --> L2
`;

const BIZ_CATALOGUE = `
flowchart LR
  M1[Open Catalogue module] --> M2[Create new catalogue<br/>name + template]
  M2 --> M3[Add SKUs from listings]
  M3 --> M4[Review prices, images]
  M4 --> M5[Export PDF or XLSX]
  M5 --> M6[Email / share with buyer]
`;

const BIZ_VENDOR_ONBOARD = `
flowchart LR
  N1[Procurement agrees terms] --> N2[Create vendor record<br/>name, GST, contact]
  N2 --> N3[Link new SKUs<br/>to vendor]
  N3 --> N4[Raise first PO]
  N4 --> N5[Catalogue + label data<br/>available for use]
`;

const BIZ_STOCK_RECON = `
flowchart LR
  R1[Physical count<br/>by SKU + bin] --> R2[Enter into spreadsheet<br/>using Zap template]
  R2 --> R3[Upload via<br/>Bulk Operations]
  R3 --> R4[Zap flags<br/>discrepancies]
  R4 --> R5[Investigate<br/>each discrepancy]
  R5 --> R6[Adjustments<br/>logged with reason]
  R6 --> R7[Reconciliation report<br/>downloaded for audit]
`;

const BIZ_AUTH = `
flowchart LR
  U[User opens Zap] --> L[Sign in<br/>email + password]
  L --> R[Role assigned<br/>e.g. Ops, Warehouse, Admin]
  R --> M{Modules visible}
  M --> M1[Inbound — if role includes inbound]
  M --> M2[Outbound — if role includes outbound]
  M --> M3[Catalogue, Vendors, Bulk Ops, etc.]
  M --> H[Hidden if role doesn't include]
`;

const BIZ_FILES = `
flowchart LR
  U[User uploads<br/>invoice / PDF] --> S[Stored in<br/>Zap Storage]
  S --> L[Linked to the<br/>PO or GRN record]
  D[User clicks download] --> CHK{File in<br/>Zap Storage?}
  CHK -->|Yes| GET[Streamed to user]
  CHK -->|No| MISS["Shown as 'not yet uploaded'<br/>— ops to attach the file"]
`;

const BIZ_CROSS_MODULE = `
flowchart TB
  V[Vendor Records] --> IPO[Inbound POs]
  IPO --> GRN[GRN — Goods Received]
  GRN --> S[Stock Levels Updated]
  S --> LP[Product Listings]
  LP --> CAT[Catalogue Builder]
  CAT --> EX[Buyer Catalogue Exports]
  S --> OPO[Outbound POs]
  OPO --> LB[Label Generation]
  LB --> DSP[Dispatch]
  BO[Bulk Operations] --> S
  BO --> LP
`;

// ── Reference data ──────────────────────────────────────────────────────────

const STATUS_BADGE_CLASS: Record<string, string> = {
  CLOSED: "border-violet-400 text-violet-700 dark:text-violet-300 text-xs",
  ISSUED: "border-emerald-400 text-emerald-700 dark:text-emerald-300 text-xs",
  EXPORTED: "border-amber-400 text-amber-700 dark:text-amber-300 text-xs",
  DRAFT: "border-slate-400 text-slate-700 dark:text-slate-300 text-xs",
};

// ── Accordion section (native <details> for zero-dep, reliable behaviour) ───

type FlowGroup =
  | "inbound"
  | "outbound"
  | "listings"
  | "inventory"
  | "business";

const GROUP_BADGE_CLASS: Record<FlowGroup, string> = {
  inbound: "border-sky-400 text-sky-700 dark:text-sky-300",
  outbound: "border-emerald-400 text-emerald-700 dark:text-emerald-300",
  listings: "border-amber-400 text-amber-700 dark:text-amber-300",
  inventory: "border-rose-400 text-rose-700 dark:text-rose-300",
  business: "border-violet-400 text-violet-700 dark:text-violet-300",
};

function AccordionSection({
  title,
  description,
  badge,
  badgeVariant = "secondary",
  defaultOpen = false,
  group,
  children,
}: Readonly<{
  title: string;
  description: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive";
  defaultOpen?: boolean;
  group?: FlowGroup;
  children: React.ReactNode;
}>) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        "group border-primary/10 overflow-hidden rounded-lg border shadow-sm",
        "bg-card text-card-foreground"
      )}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-start justify-between gap-3 px-5 py-4",
          "border-b border-transparent group-open:border-border",
          "bg-gradient-to-r from-primary/8 via-muted/30 to-transparent",
          "hover:bg-muted/40 transition-colors"
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <ChevronDown
            className={cn(
              "text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform",
              "group-open:rotate-180"
            )}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{title}</h3>
              {group ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-normal uppercase tracking-wide",
                    GROUP_BADGE_CLASS[group]
                  )}
                >
                  {group}
                </Badge>
              ) : null}
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
          </div>
        </div>
        {badge ? (
          <Badge variant={badgeVariant} className="shrink-0 text-xs">
            {badge}
          </Badge>
        ) : null}
      </summary>
      <div className="px-5 py-6">{children}</div>
    </details>
  );
}

function AccordionGroup({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <section className="space-y-3">
      <h2 className="text-foreground text-sm font-semibold uppercase tracking-wide">
        {label}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function InboundFlowsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-2 py-6 md:px-4">
      <AppPageTitle
        title="Process Flows"
        description="Inbound, outbound, listings, inventory, and business reference flows. Click any section to expand."
      />

      <p className="text-muted-foreground -mt-6 max-w-4xl px-2 text-xs leading-relaxed md:px-0">
        How orders, goods, stock, and reports actually move through your day. Use these flows to onboard new
        team members, settle a process question on the floor, or trace where a stuck PO / GRN / consignment is
        in its lifecycle. Each section is grouped by the team that owns it — color-coded badges make it easy
        to find what your role cares about (inbound, outbound, listings, inventory, or end-to-end business).
      </p>

      <div className="border-primary/20 bg-primary/5 text-foreground rounded-md border px-3 py-2 text-xs leading-relaxed">
        <span className="font-medium">Source of truth:</span> Zap runs entirely on its own PostgreSQL database — UI and
        APIs read and write Postgres only. Records you see with <code className="text-[11px]">source = eautomate</code>{" "}
        were brought in by a one-time historical import; there is no live, request-time dependency on eAutomate in
        production.
      </div>

      <div className="border-primary/20 bg-primary/5 text-foreground rounded-md border px-3 py-2 text-xs leading-relaxed">
        <span className="font-medium">Engineers:</span> the architectural rules behind every flow live in{" "}
        <code className="text-[11px]">docs/zap-doctrine.md</code>{" "}
        — read it before changing anything that affects data boundaries, ID allocation, or the historical
        import pipeline.
      </div>

      {/* ── Group A: Inbound technical flows ───────────────────────────────── */}
      <AccordionGroup label="Inbound — technical (GRN, debit / credit notes)">
        <AccordionSection
          group="inbound"
          title="GRN Lifecycle — Full Flow"
          description="PO generation through inventory receipt, including shortage/damage branch and accounts rejection loop."
          badge="grn_status · grn_audit_status · accounts_status"
          badgeVariant="outline"
          defaultOpen
        >
          <MermaidDiagram chart={GRN_LIFECYCLE} />
        </AccordionSection>

        <AccordionSection
          group="inbound"
          title="Invoice Collection & Accounts Approval"
          description="Post-audit steps: invoice collection, accounts approval (with rejection + re-submission), and inventory receipt."
          badge="grn_invoice_collection_status · accounts_status"
          badgeVariant="outline"
        >
          <MermaidDiagram chart={INVOICE_COLLECT_FLOW} />
        </AccordionSection>

        <AccordionSection
          group="inbound"
          title="Zap Debit Note — Rate Discrepancy"
          description="Created in Zap when the vendor's price exceeds the audit price. All transitions: DRAFT, ISSUED, EXPORTED, CLOSED."
          badge="inbound_zap_debit_notes"
          badgeVariant="secondary"
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-medium text-muted-foreground">Step-by-step flow</p>
              <MermaidDiagram chart={ZAP_DEBIT_NOTE} />
            </div>
            <div>
              <p className="mb-3 text-xs font-medium text-muted-foreground">State transitions</p>
              <MermaidDiagram chart={ZAP_DN_STATE} />
            </div>
          </div>

          <Table className="mt-6">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Trigger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["DRAFT", "Often auto-created after GRN close when rate-diff lines exist, or via POST debit-note / Generate; reference = DN-GRN-{id}-{YYYYMMDD}"],
                ["ISSUED", "Accounts team assigns a real DN number in the Zap UI"],
                ["EXPORTED", "Tally CSV downloaded via debit-note/export"],
                ["CLOSED", "Vendor CN copy file uploaded via cn-copy endpoint"],
              ].map(([status, trigger]) => (
                <TableRow key={status}>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_BADGE_CLASS[status] ?? "text-xs"}>
                      {status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{trigger}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AccordionSection>

        <AccordionSection
          group="inbound"
          title="GRN Credit / Debit Note — Shortage & Damage"
          description="Captured against the GRN (either entered in Zap or carried over from the historical import). Covers both note types, missing-number path, upload, and reverse note."
          badge="inbound_grn_debit_credit_notes"
          badgeVariant="secondary"
        >
          <MermaidDiagram chart={GRN_DCN} className="mb-6" />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Field</TableHead>
                <TableHead className="text-xs">Values</TableHead>
                <TableHead className="text-xs">Purpose</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["credit_debit_note_type", "DEBIT_NOTE / CREDIT_NOTE", "Whether Zap is owed money (debit) or owes vendor (credit)"],
                ["credit_debit_note_number", "string", "Assigned by accounts / vendor"],
                ["credit_debit_note_number_assignment_status", "ASSIGNED / NOT_ASSIGNED", "Drives Pending Debit & Credit queue"],
                ["credit_debit_note_upload_status", "UPLOADED / NOT_UPLOADED", "Whether supporting document is uploaded"],
                ["reverse_credit_debit_note_number", "string / null", "Set when a reverse note cancels the original"],
              ].map(([field, values, purpose]) => (
                <TableRow key={field}>
                  <TableCell className="font-mono text-xs">{field}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{values}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{purpose}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AccordionSection>

        <AccordionSection
          group="inbound"
          title="Two Note Systems — Side-by-Side"
          description="Both note types can exist for the same GRN simultaneously. They are tracked in separate tables and managed independently."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs" />
                <TableHead className="text-xs">Zap Debit Note</TableHead>
                <TableHead className="text-xs">GRN DCN (shortage / damage)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["Source", "Created in Zap by accounts team", "Captured against the GRN — either entered in Zap or carried over from the historical import"],
                ["Trigger", "Rate discrepancy found at audit", "Shortage / damage reported at GRN time"],
                ["Timing", "After audit (grn_audit_status=CLOSED)", "During GRN sync (before audit)"],
                ["Table", "inbound_zap_debit_notes", "inbound_grn_debit_credit_notes"],
                ["Types", "Debit note only", "DEBIT_NOTE or CREDIT_NOTE"],
                ["Lifecycle", "DRAFT → ISSUED → EXPORTED → CLOSED", "NOT_ASSIGNED → ASSIGNED → UPLOADED → Settled"],
                ["Reversal", "Not applicable", "Reverse note number + upload"],
              ].map(([label, zap, ea]) => (
                <TableRow key={label}>
                  <TableCell className="text-xs font-medium text-muted-foreground">{label}</TableCell>
                  <TableCell className="text-xs">{zap}</TableCell>
                  <TableCell className="text-xs">{ea}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AccordionSection>
      </AccordionGroup>

      {/* ── Group B: Outbound flows ────────────────────────────────────────── */}
      <AccordionGroup label="Outbound — PO lifecycle, consignment, pending queues">
        <AccordionSection
          group="outbound"
          title="Outbound PO Lifecycle"
          description="From PO appearing in Zap (created in Zap or carried over from the historical import) through Acknowledge, WIP, consignment, dispatch, pending invoice, and PO close."
          badge="outbound_purchase_orders · is_wip · calculated_po_status"
          badgeVariant="outline"
        >
          <MermaidDiagram chart={OUTBOUND_PO_LIFECYCLE} />
        </AccordionSection>

        <AccordionSection
          group="outbound"
          title="Partial PO Recovery — /outbound/partial"
          description="POs that fail full-creation validation land here as PARTIAL; operator resumes and completes them later."
          badge="po_creation_status = PARTIAL"
          badgeVariant="outline"
        >
          <MermaidDiagram chart={OUTBOUND_PARTIAL_RECOVERY} />
        </AccordionSection>

        <AccordionSection
          group="outbound"
          title="Consignment Dispatch"
          description="Consignment creation persists to Zap Postgres. Includes label generation and dispatch marking."
          badge="outbound_consignments"
          badgeVariant="secondary"
        >
          <MermaidDiagram chart={OUTBOUND_CONSIGNMENT_DISPATCH} />
        </AccordionSection>

        <AccordionSection
          group="outbound"
          title="Pending Invoice Queue — /outbound/pending-invoices"
          description="Awaiting vendor invoice copy after dispatch; clears once invoice received and reconciled."
          badge="invoice_status · pending"
          badgeVariant="outline"
        >
          <MermaidDiagram chart={OUTBOUND_PENDING_INVOICE} />
        </AccordionSection>
      </AccordionGroup>

      {/* ── Group C: Listings flows ────────────────────────────────────────── */}
      <AccordionGroup label="Listings — catalogue, bulk ops, packs, labels, focus">
        <AccordionSection
          group="listings"
          title="Warehouse Listing Creation"
          description="Three sources land into the same listing row: manual form entry, bulk spreadsheet import, or the one-time historical import."
          badge="listings · secondary_listings"
          badgeVariant="outline"
          defaultOpen
        >
          <MermaidDiagram chart={LISTINGS_WAREHOUSE_CREATE} />
        </AccordionSection>

        <AccordionSection
          group="listings"
          title="Bulk Operations Pipeline — /listings/bulk"
          description="Spreadsheet upload → schema validation → batched DB writes → diff CSV. Errors surface per row."
          badge="bulk_operations · audit log"
          badgeVariant="secondary"
        >
          <MermaidDiagram chart={LISTINGS_BULK_OPERATIONS} />
        </AccordionSection>

        <AccordionSection
          group="listings"
          title="Packs & Combos — /listings/packs-combos"
          description="A pack is a parent SKU defined in terms of child SKUs + quantities. Inventory derives from the children."
          badge="pack_combo · pack_combo_lines"
          badgeVariant="outline"
        >
          <MermaidDiagram chart={LISTINGS_PACKS_COMBOS} />
        </AccordionSection>

        <AccordionSection
          group="listings"
          title="Labels Master Data — /listings/labels-master"
          description="Per-SKU label fields (MRP, manufacturer, FSSAI, etc.) used by Phase-1 box labels and product label PDFs."
          badge="labels_master_data"
          badgeVariant="secondary"
        >
          <MermaidDiagram chart={LISTINGS_LABELS_MASTER} />
        </AccordionSection>

        <AccordionSection
          group="listings"
          title="Focus List — /listings/focus"
          description="Curated priority SKUs surfaced across the home dashboard, inbound, and outbound views."
          badge="focus_list"
          badgeVariant="secondary"
        >
          <MermaidDiagram chart={LISTINGS_FOCUS_LIST} />
        </AccordionSection>
      </AccordionGroup>

      {/* ── Group D: Inventory flows ───────────────────────────────────────── */}
      <AccordionGroup label="Inventory — inflow, dispatch, packs, reconciliation">
        <AccordionSection
          group="inventory"
          title="Inventory Inflow from GRN"
          description="Once a GRN clears audit + accounts, the operator maps SKU → bin → qty and stock becomes available."
          badge="warehouse_inventory_log · listings.available_quantity"
          badgeVariant="outline"
        >
          <MermaidDiagram chart={INVENTORY_GRN_INFLOW} />
        </AccordionSection>

        <AccordionSection
          group="inventory"
          title="Dispatch Decrement + Reorder Alerts"
          description="Each dispatched line decrements available_quantity and may trigger a Reorder Alert if below threshold."
          badge="dispatch · reorder_alerts"
          badgeVariant="secondary"
        >
          <MermaidDiagram chart={INVENTORY_DISPATCH_DECREMENT} />
        </AccordionSection>

        <AccordionSection
          group="inventory"
          title="Packs & Secondary Inventory"
          description="Pack SKUs explode into component reservations; bottleneck child triggers shortage flags."
          badge="inventory/packs · inventory/secondary"
          badgeVariant="outline"
        >
          <MermaidDiagram chart={INVENTORY_PACKS_SECONDARY} />
        </AccordionSection>

        <AccordionSection
          group="inventory"
          title="Stock Reconciliation"
          description="Physical count vs system qty via Bulk Operations; discrepancies investigated and adjusted with reasons."
          badge="adjustment · audit"
          badgeVariant="outline"
        >
          <MermaidDiagram chart={INVENTORY_RECONCILIATION} />
        </AccordionSection>
      </AccordionGroup>

      {/* ── Group E: Business workflows ────────────────────────────────────── */}
      <AccordionGroup label="Business — end-to-end operational flows">
        <AccordionSection
          group="business"
          title="How modules connect"
          description="High-level map of how vendor records, POs, GRNs, listings, catalogues, and dispatch share the same data."
        >
          <MermaidDiagram chart={BIZ_CROSS_MODULE} />
        </AccordionSection>

        <AccordionSection
          group="business"
          title="Workflow 1 — Vendor Order to Stock Receipt (Inbound)"
          description="Procurement → Vendor → Warehouse → Finance. From PO raise through stock-on-hand update."
        >
          <MermaidDiagram chart={BIZ_INBOUND} />
        </AccordionSection>

        <AccordionSection
          group="business"
          title="Workflow 2 — Channel Order Fulfilment (Outbound)"
          description="Channel → Ops → Warehouse → Logistics. End-to-end fulfilment runs entirely within Zap."
        >
          <MermaidDiagram chart={BIZ_OUTBOUND} />
        </AccordionSection>

        <AccordionSection
          group="business"
          title="Workflow 3 — Catalogue Creation and Sharing"
          description="Merchandiser builds a catalogue from listings and exports a buyer-ready PDF/XLSX."
        >
          <MermaidDiagram chart={BIZ_CATALOGUE} />
        </AccordionSection>

        <AccordionSection
          group="business"
          title="Workflow 4 — New Vendor Onboarding"
          description="From terms agreement to first PO, with vendor master and SKU links."
        >
          <MermaidDiagram chart={BIZ_VENDOR_ONBOARD} />
        </AccordionSection>

        <AccordionSection
          group="business"
          title="Workflow 5 — Stock Reconciliation"
          description="Physical count → bulk import → discrepancy review → adjustments → audit report."
        >
          <MermaidDiagram chart={BIZ_STOCK_RECON} />
        </AccordionSection>

        <AccordionSection
          group="business"
          title="Workflow 6 — Logging in & Permissions"
          description="What each user sees is governed by their role; modules are hidden when the role excludes them."
        >
          <MermaidDiagram chart={BIZ_AUTH} />
        </AccordionSection>

        <AccordionSection
          group="business"
          title="Workflow 7 — Files & Attachments"
          description="Uploads land in Zap Storage. Missing files surface as 'not yet uploaded' for ops to attach — files are served from Zap only."
        >
          <MermaidDiagram chart={BIZ_FILES} />
        </AccordionSection>
      </AccordionGroup>
    </div>
  );
}
