/**
 * Shared, self-explanatory GRN status presentation.
 * Used by the PO detail page (GRN cards) and the GRN detail page header so the
 * label, color, and hover help stay identical across the app.
 */

export type GrnStatusDisplay = {
  label: string;
  className: string;
  help?: string;
};

export function grnStatusDisplay(raw: string | null | undefined): GrnStatusDisplay {
  const up = String(raw ?? "").trim().toUpperCase();
  if (!up || up === "—") {
    return { label: "—", className: "" };
  }
  switch (up) {
    case "OPEN":
      return {
        label: "Receipt open",
        className:
          "bg-blue-600/15 text-blue-700 dark:text-blue-400 border-blue-600/30",
        help: "GRN is open; line quantities and prices can still be edited until you close it.",
      };
    case "CLOSED":
    case "DONE":
    case "COMPLETED":
    case "SETTLED":
      return {
        label: "Fully received",
        className:
          "bg-violet-600/15 text-violet-700 dark:text-violet-400 border-violet-600/30",
        help: "GRN is closed; received quantities and prices are finalized for this receipt.",
      };
    case "CANCELLED":
      return {
        label: "Cancelled",
        className: "bg-destructive/15 text-destructive border-destructive/30",
        help: "GRN has been cancelled; it no longer contributes to receipts.",
      };
    case "DRAFT":
    case "DRAFT_ZAP":
      return {
        label: "Draft",
        className: "bg-muted text-muted-foreground border-border",
        help: "Zap-created draft tied to the PO. Promote it to OPEN (or register an operational GRN number) to start recording the receipt.",
      };
    default:
      return { label: String(raw).trim(), className: "" };
  }
}
