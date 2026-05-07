"use client";

import * as React from "react";
import { MermaidDiagram } from "@/components/ui/mermaid";
import { AppPageTitle } from "@/components/layout/app-page-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const GRN_LIFECYCLE = `
flowchart TD
    PO["PO Generated in eAutomate"] --> GRN_OPEN

    GRN_OPEN["GRN Opened
grn_status = OPEN
Source: eAutomate sync"] --> QTY_UPDATE

    QTY_UPDATE["Quantity Update
invoice qty / accepted / rejected / shortage
Source: eAutomate GRN items sync"] --> DN_SHORT{Shortage or
Damage?}

    DN_SHORT -->|Yes| DN_SHORTAGE["eAutomate Debit / Credit Note created
shortage / damage / vendor adjustment
See eAutomate DCN flow"]
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
Source: eAutomate sync flag"] --> AUDIT_ACTION

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

const EA_DCN = `
flowchart TD
    EA_SYNC["eAutomate Sync
GRN details ingested"] --> NOTE_EXISTS{DCN exists
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

const STATUS_BADGE_CLASS: Record<string, string> = {
  CLOSED: "border-violet-400 text-violet-700 dark:text-violet-300 text-xs",
  ISSUED: "border-emerald-400 text-emerald-700 dark:text-emerald-300 text-xs",
  EXPORTED: "border-amber-400 text-amber-700 dark:text-amber-300 text-xs",
  DRAFT: "border-slate-400 text-slate-700 dark:text-slate-300 text-xs",
};

function SectionCard({
  title,
  description,
  badge,
  badgeVariant = "secondary",
  children,
}: Readonly<{
  title: string;
  description: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive";
  children: React.ReactNode;
}>) {
  return (
    <Card className="overflow-hidden border-primary/10 shadow-sm">
      <CardHeader className="border-b bg-gradient-to-r from-primary/8 via-muted/30 to-transparent pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-0.5 text-xs">{description}</CardDescription>
          </div>
          {badge ? <Badge variant={badgeVariant} className="shrink-0 text-xs">{badge}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="pt-6">{children}</CardContent>
    </Card>
  );
}

export default function InboundFlowsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-2 py-6 md:px-4">
      <AppPageTitle
        title="GRN · Debit Note · Credit Note Flows"
        description="Reference diagrams for inbound goods receipt and debit/credit artefacts. Canonical operator narrative—including Zap-required order (invoice uploaded before Close GRN)—is in docs: web/docs/services/inbound/inbound-tab-process-notes.md."
      />

      <p className="text-muted-foreground -mt-6 max-w-4xl px-2 text-xs leading-relaxed md:px-0">
        Diagrams below are simplified; discrepancies versus live behaviour are resolved against the codebase and inbound-grn-debit-credit-note-flows.md (e.g., vendor invoice precedes POST /close).
      </p>

      {/* ── GRN Lifecycle ─────────────────────────────────────────────────── */}
      <SectionCard
        title="GRN Lifecycle — Full Flow"
        description="Complete journey from PO generation to inventory receipt, including shortage/damage branch and accounts rejection loop."
        badge="grn_status · grn_audit_status · accounts_status"
        badgeVariant="outline"
      >
        <MermaidDiagram chart={GRN_LIFECYCLE} />
      </SectionCard>

      {/* ── Invoice Collection & Accounts ─────────────────────────────────── */}
      <SectionCard
        title="Invoice Collection & Accounts Approval — All Cases"
        description="Detailed view of the post-audit steps: invoice collection, accounts approval (including rejection and re-submission), and final inventory receipt."
        badge="grn_invoice_collection_status · accounts_status"
        badgeVariant="outline"
      >
        <MermaidDiagram chart={INVOICE_COLLECT_FLOW} />
      </SectionCard>

      {/* ── Zap Debit Note ────────────────────────────────────────────────── */}
      <SectionCard
        title="Zap Debit Note — Rate Discrepancy (All Paths)"
        description="Created inside Zap when vendor price exceeds audit price. Shows all valid transitions between DRAFT, ISSUED, EXPORTED, and CLOSED."
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
              [
                "DRAFT",
                'Often auto-created after GRN close when rate-diff lines exist, or via POST debit-note / Generate; reference = DN-GRN-{id}-{YYYYMMDD}',
              ],
              ["ISSUED", "Accounts team assigns a real DN number in the Zap UI"],
              ["EXPORTED", "Tally CSV downloaded via debit-note/export"],
              ["CLOSED", "Vendor CN copy file uploaded via cn-copy endpoint"],
            ].map(([status, trigger]) => (
              <TableRow key={status}>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={STATUS_BADGE_CLASS[status] ?? "text-xs"}
                  >
                    {status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{trigger}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      {/* ── eAutomate DCN ─────────────────────────────────────────────────── */}
      <SectionCard
        title="eAutomate Credit / Debit Note — Shortage & Damage (All Cases)"
        description="Synced from eAutomate during GRN details ingest. Covers both note types, missing-number path, upload, and optional reverse note."
        badge="inbound_grn_debit_credit_notes"
        badgeVariant="secondary"
      >
        <MermaidDiagram chart={EA_DCN} className="mb-6" />

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
      </SectionCard>

      {/* ── Comparison table ──────────────────────────────────────────────── */}
      <SectionCard
        title="Key Distinction — Two Separate Note Systems"
        description="Both note types can exist for the same GRN simultaneously. They are tracked in separate tables and managed independently."
        badge=""
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs" />
              <TableHead className="text-xs">Zap Debit Note</TableHead>
              <TableHead className="text-xs">eAutomate DCN</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              ["Source", "Created in Zap by accounts team", "Synced from eAutomate automatically"],
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
      </SectionCard>
    </div>
  );
}
