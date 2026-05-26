"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiUrl, getStoredToken } from "@/lib/api-browser";
import { useAuth } from "@/contexts/auth-context";
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { SearchableSelect } from "@/components/outbound/searchable-select";
import { TripletDatePicker } from "@/components/outbound/triplet-date-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OUTBOUND_PO_TYPES } from "@/lib/outbound-po-types";

const textareaClass =
  "border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[100px] w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const MAX_PO_FILE_BYTES = 2 * 1024 * 1024;

type NewPoFormValues = {
  soldViaCode: string | null;
  companyId: string | null;
  poNumber: string;
  poLocation: string;
  billingAddress: string;
  shippingAddress: string;
  buyerGstin: string;
  releaseDate: Date | null;
  expiryDate: Date | null;
  poType: string | null;
  pdfFile: File | null;
  spreadsheetFile: File | null;
};

function utcCalendarDayMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Expiry must be on a later calendar day than release (UTC). */
function isExpiryAfterRelease(release: Date, expiry: Date): boolean {
  return utcCalendarDayMs(expiry) > utcCalendarDayMs(release);
}

function classifyPoUploadLocal(file: File): "pdf" | "spreadsheet" | "other" {
  const lower = file.name.toLowerCase();
  const mt = (file.type || "").toLowerCase();
  if (lower.endsWith(".pdf") || mt === "application/pdf" || mt.includes("pdf")) {
    return "pdf";
  }
  if (
    lower.endsWith(".csv") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    mt.includes("spreadsheet") ||
    mt.includes("csv") ||
    mt.includes("excel") ||
    mt.includes("sheet") ||
    mt === "application/vnd.ms-excel" ||
    mt ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mt === "text/csv"
  ) {
    return "spreadsheet";
  }
  return "other";
}

function validatePoPdfFile(file: File | null): string | undefined {
  if (!file) return "PO PDF is required.";
  if (classifyPoUploadLocal(file) !== "pdf") return "Upload a PDF file only.";
  if (file.size > MAX_PO_FILE_BYTES) return "PDF exceeds the 2MB limit.";
  return undefined;
}

function validatePoSpreadsheetFile(file: File | null): string | undefined {
  if (!file) return "PO spreadsheet is required.";
  if (classifyPoUploadLocal(file) !== "spreadsheet") {
    return "Upload a CSV or Excel spreadsheet only.";
  }
  if (file.size > MAX_PO_FILE_BYTES) return "Spreadsheet exceeds the 2MB limit.";
  return undefined;
}

function collectNewPoFieldErrors(values: NewPoFormValues): Record<string, string> {
  const err: Record<string, string> = {};
  if (!values.soldViaCode) err.soldVia = "Select Sold Via.";
  if (!values.companyId) err.company = "Select Company.";
  if (values.poNumber.trim().length === 0) {
    err.poNumber = "PO Number is required.";
  } else if (values.poNumber.trim().length > 80) {
    err.poNumber = "PO Number must be at most 80 characters.";
  }
  if (values.poLocation.trim().length < 2) {
    err.poLocation = "PO location is required (at least 2 characters).";
  }
  if (values.billingAddress.trim().length < 3) {
    err.billingAddress = "Billing address is required (at least 3 characters).";
  }
  if (values.shippingAddress.trim().length < 3) {
    err.shippingAddress = "Shipping address is required (at least 3 characters).";
  }
  const g = values.buyerGstin.trim();
  if (g.length > 0) {
    if (g.length !== 15) {
      err.buyerGstin = "GSTIN must be exactly 15 characters or left empty.";
    } else if (!GSTIN_RE.test(g)) {
      err.buyerGstin = "Enter a valid GSTIN or leave the field empty.";
    }
  }
  if (!values.releaseDate) {
    err.releaseDate = "Select PO release date.";
  }
  if (!values.expiryDate) {
    err.expiryDate = "Select PO expiry date.";
  }
  if (
    values.releaseDate &&
    values.expiryDate &&
    !isExpiryAfterRelease(values.releaseDate, values.expiryDate)
  ) {
    err.expiryDate = "Expiry date must be after the release date.";
  }
  if (!values.poType) err.poType = "Select PO type.";
  const pdfErr = validatePoPdfFile(values.pdfFile);
  if (pdfErr) err.poPdf = pdfErr;
  const ssErr = validatePoSpreadsheetFile(values.spreadsheetFile);
  if (ssErr) err.poSpreadsheet = ssErr;
  return err;
}

type NewPoFieldKey =
  | "soldVia"
  | "company"
  | "poNumber"
  | "poLocation"
  | "billingAddress"
  | "shippingAddress"
  | "buyerGstin"
  | "releaseDate"
  | "expiryDate"
  | "poType"
  | "poPdf"
  | "poSpreadsheet";

function filterVisibleFieldErrors(
  errors: Record<string, string>,
  touched: Partial<Record<NewPoFieldKey, boolean>>,
  showAll: boolean
): Record<string, string> {
  if (showAll) return errors;
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors)) {
    if (touched[key as NewPoFieldKey]) out[key] = message;
  }
  return out;
}

function markTouchedOnContainerBlur(
  e: React.FocusEvent<HTMLElement>,
  touch: () => void
) {
  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
    touch();
  }
}

type SoldViaOpt = { code: string; label: string };
type CompanyOpt = {
  id: number;
  name: string | null;
  description: string | null;
  logo_url?: string | null;
};

async function authFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const token = getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(apiUrl(path), { ...init, headers });
}

export default function OutboundNewPoPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("purchase_orders", "create");

  const [loading, setLoading] = React.useState(true);
  const [soldVia, setSoldVia] = React.useState<SoldViaOpt[]>([]);
  const [companies, setCompanies] = React.useState<CompanyOpt[]>([]);

  const [soldViaCode, setSoldViaCode] = React.useState<string | null>(null);
  const [companyId, setCompanyId] = React.useState<string | null>(null);
  const [poNumber, setPoNumber] = React.useState("");
  const [poLocation, setPoLocation] = React.useState("");
  const [billingAddress, setBillingAddress] = React.useState("");
  const [shippingAddress, setShippingAddress] = React.useState("");
  const [buyerGstin, setBuyerGstin] = React.useState("");
  const [releaseDate, setReleaseDate] = React.useState<Date | null>(null);
  const [expiryDate, setExpiryDate] = React.useState<Date | null>(null);
  const [poType, setPoType] = React.useState<string | null>(null);
  const [pdfFile, setPdfFile] = React.useState<File | null>(null);
  const [spreadsheetFile, setSpreadsheetFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [touched, setTouched] = React.useState<Partial<Record<NewPoFieldKey, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = React.useState(false);

  const touchField = React.useCallback((key: NewPoFieldKey) => {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);

  const loadOptions = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/outbound/form-options");
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      const data = (await res.json()) as {
        soldVia: SoldViaOpt[];
        companies: CompanyOpt[];
        companySync?: {
          ok: boolean;
          upserted: number;
          skipped: boolean;
          error?: string;
        };
      };
      setSoldVia(data.soldVia ?? []);
      setCompanies(data.companies ?? []);
      const sync = data.companySync;
      if (sync?.error) {
        toast.warning(
          `Could not refresh company list (${sync.error}). Showing data already saved in Zap.`
        );
      } else if (sync?.ok && !sync.skipped && sync.upserted > 0) {
        toast.success(`Updated ${sync.upserted} companies from the directory.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load form");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const soldViaOptions = soldVia.map((s) => ({
    key: s.code,
    label: s.label,
  }));
  const companyOptions = companies.map((c) => ({
    key: String(c.id),
    label: `${c.name ?? "—"} [${c.id}]`,
    imageUrl: c.logo_url,
    imageName: c.name,
  }));
  const poTypeOptions = OUTBOUND_PO_TYPES.map((t) => ({ key: t, label: t }));
  const formValues = React.useMemo<NewPoFormValues>(
    () => ({
      soldViaCode,
      companyId,
      poNumber,
      poLocation,
      billingAddress,
      shippingAddress,
      buyerGstin,
      releaseDate,
      expiryDate,
      poType,
      pdfFile,
      spreadsheetFile,
    }),
    [
      soldViaCode,
      companyId,
      poNumber,
      poLocation,
      billingAddress,
      shippingAddress,
      buyerGstin,
      releaseDate,
      expiryDate,
      poType,
      pdfFile,
      spreadsheetFile,
    ]
  );
  const validationErrors = React.useMemo(
    () => collectNewPoFieldErrors(formValues),
    [formValues]
  );
  const visibleErrors = React.useMemo(
    () => filterVisibleFieldErrors(validationErrors, touched, submitAttempted),
    [validationErrors, touched, submitAttempted]
  );
  const formComplete = Object.keys(validationErrors).length === 0;
  const selectedCompany =
    companyId ? companies.find((c) => String(c.id) === companyId) ?? null : null;
  const selectedCompanyDescription =
    selectedCompany?.description?.trim() ? selectedCompany.description : null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    if (!formComplete) {
      setSubmitAttempted(true);
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("soldViaCode", soldViaCode ?? "");
      fd.set("companyId", companyId ?? "");
      fd.set("poNumber", poNumber.trim());
      fd.set("poLocation", poLocation);
      fd.set("billingAddress", billingAddress);
      fd.set("shippingAddress", shippingAddress);
      fd.set("buyerGstin", buyerGstin.trim());
      fd.set("poReleaseIso", releaseDate ? releaseDate.toISOString() : "");
      fd.set("poExpiryIso", expiryDate ? expiryDate.toISOString() : "");
      fd.set("poType", poType ?? "");
      if (pdfFile) fd.append("po_files", pdfFile);
      if (spreadsheetFile) fd.append("po_files", spreadsheetFile);
      const res = await authFetch("/api/outbound/purchase-orders", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      toast.success(`Purchase order ${data.po_number} created`);
      router.push(`/outbound/po/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!canCreate) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-2 py-4 md:px-4">
        <AppPageTitle
          title="Add New Purchase Order"
          description="You do not have permission to create outbound purchase orders."
        />
        <Card>
          <CardContent className="text-muted-foreground pt-6 text-sm">
            Ask an administrator to grant <span className="font-mono">purchase_orders</span>{" "}
            <span className="font-mono">create</span>.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-2 py-4 md:px-4">
      <AppPageTitle title="Add New Purchase Order" />

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading form…</p>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
          <Card className="border-primary/15 shadow-sm">
            <CardContent className="space-y-8 p-4 sm:p-6">
              {/* Identity */}
              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Identity</h2>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="po-number">PO Number</Label>
                    <Input
                      id="po-number"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      onBlur={() => touchField("poNumber")}
                      className="min-h-11"
                      placeholder="Buyer's PO Number"
                      maxLength={80}
                      aria-invalid={!!visibleErrors.poNumber}
                    />
                    {visibleErrors.poNumber ? (
                      <p className="text-destructive text-xs">{visibleErrors.poNumber}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label>Sold Via</Label>
                    <SearchableSelect
                      value={soldViaCode}
                      onChange={setSoldViaCode}
                      onBlur={() => touchField("soldVia")}
                      options={soldViaOptions}
                      placeholder="Select Sold Via"
                      emptyText="No sold-via options"
                      variant="soft"
                    />
                    {visibleErrors.soldVia ? (
                      <p className="text-destructive text-xs">{visibleErrors.soldVia}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label>Company</Label>
                    <SearchableSelect
                      value={companyId}
                      onChange={setCompanyId}
                      onBlur={() => touchField("company")}
                      options={companyOptions}
                      placeholder="Select Company"
                      emptyText="No companies in Zap yet — check sync credentials and refresh."
                    />
                    {visibleErrors.company ? (
                      <p className="text-destructive text-xs">{visibleErrors.company}</p>
                    ) : selectedCompanyDescription ? (
                      <p className="text-muted-foreground text-xs">{selectedCompanyDescription}</p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="po-loc">PO Location</Label>
                    <Input
                      id="po-loc"
                      value={poLocation}
                      onChange={(e) => setPoLocation(e.target.value)}
                      onBlur={() => touchField("poLocation")}
                      className="min-h-11"
                      placeholder="PO Location"
                      minLength={2}
                      aria-invalid={!!visibleErrors.poLocation}
                    />
                    {visibleErrors.poLocation ? (
                      <p className="text-destructive text-xs">{visibleErrors.poLocation}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label>PO Type</Label>
                    <SearchableSelect
                      value={poType}
                      onChange={setPoType}
                      onBlur={() => touchField("poType")}
                      options={poTypeOptions}
                      placeholder="Select PO Type"
                      emptyText="No PO types"
                      variant="soft"
                    />
                    {visibleErrors.poType ? (
                      <p className="text-destructive text-xs">{visibleErrors.poType}</p>
                    ) : null}
                  </div>
                </div>
              </section>

              {/* Dates */}
              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Dates</h2>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div
                    className="space-y-1"
                    onBlur={(e) =>
                      markTouchedOnContainerBlur(e, () => touchField("releaseDate"))
                    }
                  >
                    <TripletDatePicker
                      title="Select PO Release date"
                      value={releaseDate}
                      onSet={setReleaseDate}
                      setButtonLabel="Set PO Release date"
                      autoCommit
                    />
                    {visibleErrors.releaseDate ? (
                      <p className="text-destructive px-1 text-xs">{visibleErrors.releaseDate}</p>
                    ) : null}
                  </div>
                  <div
                    className="space-y-1"
                    onBlur={(e) =>
                      markTouchedOnContainerBlur(e, () => touchField("expiryDate"))
                    }
                  >
                    <TripletDatePicker
                      title="Select PO expiry date"
                      value={expiryDate}
                      onSet={setExpiryDate}
                      setButtonLabel="Set PO expiry date"
                      autoCommit
                    />
                    {visibleErrors.expiryDate ? (
                      <p className="text-destructive px-1 text-xs">{visibleErrors.expiryDate}</p>
                    ) : null}
                  </div>
                </div>
              </section>

              {/* Buyer */}
              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Buyer</h2>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bill">Billing Address</Label>
                    <textarea
                      id="bill"
                      value={billingAddress}
                      onChange={(e) => setBillingAddress(e.target.value)}
                      onBlur={() => touchField("billingAddress")}
                      className={textareaClass}
                      placeholder="Billing Address"
                      minLength={3}
                      aria-invalid={!!visibleErrors.billingAddress}
                    />
                    {visibleErrors.billingAddress ? (
                      <p className="text-destructive text-xs">{visibleErrors.billingAddress}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ship">Shipping Address</Label>
                    <textarea
                      id="ship"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      onBlur={() => touchField("shippingAddress")}
                      className={textareaClass}
                      placeholder="Shipping Address"
                      minLength={3}
                      aria-invalid={!!visibleErrors.shippingAddress}
                    />
                    {visibleErrors.shippingAddress ? (
                      <p className="text-destructive text-xs">{visibleErrors.shippingAddress}</p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="gstin">Buyer GSTIN</Label>
                    <Input
                      id="gstin"
                      value={buyerGstin}
                      onChange={(e) => setBuyerGstin(e.target.value.toUpperCase())}
                      onBlur={() => touchField("buyerGstin")}
                      className="min-h-11 font-mono uppercase"
                      placeholder="Buyer GSTIN"
                      maxLength={15}
                      aria-invalid={!!visibleErrors.buyerGstin}
                    />
                    {visibleErrors.buyerGstin ? (
                      <p className="text-destructive text-xs">{visibleErrors.buyerGstin}</p>
                    ) : null}
                  </div>
                </div>
              </section>

              {/* Documents */}
              <section className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold">Original PO documents</h2>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    (Maximum 2 files are allowed. File size should not exceed 2MB. Please upload
                    both pdf and spreadsheet version of the PO.)
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2 rounded-md border p-3">
                    <Label htmlFor="po-pdf">
                      PO PDF <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="po-pdf"
                      type="file"
                      accept=".pdf,application/pdf"
                      className="min-h-11 cursor-pointer"
                      aria-required
                      aria-invalid={!!visibleErrors.poPdf}
                      onChange={(e) => {
                        setPdfFile(e.target.files?.[0] ?? null);
                        e.target.value = "";
                      }}
                      onBlur={() => touchField("poPdf")}
                    />
                    {visibleErrors.poPdf ? (
                      <p className="text-destructive text-xs">{visibleErrors.poPdf}</p>
                    ) : null}
                    {pdfFile ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-muted-foreground font-mono text-xs">
                          {pdfFile.name} ({Math.round(pdfFile.size / 1024)} KB)
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setPdfFile(null)}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2 rounded-md border p-3">
                    <Label htmlFor="po-spreadsheet">
                      PO spreadsheet <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="po-spreadsheet"
                      type="file"
                      accept=".csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                      className="min-h-11 cursor-pointer"
                      aria-required
                      aria-invalid={!!visibleErrors.poSpreadsheet}
                      onChange={(e) => {
                        setSpreadsheetFile(e.target.files?.[0] ?? null);
                        e.target.value = "";
                      }}
                      onBlur={() => touchField("poSpreadsheet")}
                    />
                    {visibleErrors.poSpreadsheet ? (
                      <p className="text-destructive text-xs">{visibleErrors.poSpreadsheet}</p>
                    ) : null}
                    {spreadsheetFile ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-muted-foreground font-mono text-xs">
                          {spreadsheetFile.name} ({Math.round(spreadsheetFile.size / 1024)} KB)
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setSpreadsheetFile(null)}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {submitAttempted && !formComplete ? (
              <p className="text-destructive order-last text-xs sm:order-first sm:mr-auto sm:text-left">
                Please fix the highlighted fields above.
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => router.push("/outbound")}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              className="bg-primary min-h-11 px-8"
              disabled={submitting || !formComplete}
              title={
                formComplete
                  ? undefined
                  : "Complete all required fields to create the purchase order"
              }
            >
              {submitting ? "Submitting…" : "Create purchase order"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
