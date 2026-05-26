"use client";

import * as React from "react";
import Link from "next/link";
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

function classifyPoUploadLocal(file: File): "pdf" | "spreadsheet" | "other" {
  const lower = file.name.toLowerCase();
  const mt = (file.type || "").toLowerCase();
  if (lower.endsWith(".pdf") || mt.includes("pdf")) return "pdf";
  if (
    lower.endsWith(".csv") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    mt.includes("spreadsheet") ||
    mt.includes("csv") ||
    mt.includes("excel") ||
    mt.includes("sheet")
  ) {
    return "spreadsheet";
  }
  return "other";
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
  const [files, setFiles] = React.useState<File[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

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
  const selectedCompany =
    companyId ? companies.find((c) => String(c.id) === companyId) ?? null : null;
  const selectedCompanyDescription =
    selectedCompany?.description?.trim() ? selectedCompany.description : null;

  const validateForm = React.useCallback((): boolean => {
    const err: Record<string, string> = {};
    if (!soldViaCode) err.soldVia = "Select Sold Via.";
    if (!companyId) err.company = "Select Company.";
    if (poNumber.trim().length === 0) {
      err.poNumber = "PO Number is required.";
    } else if (poNumber.trim().length > 80) {
      err.poNumber = "PO Number must be at most 80 characters.";
    }
    if (poLocation.trim().length < 2) err.poLocation = "PO location is required (at least 2 characters).";
    if (billingAddress.trim().length < 3) {
      err.billingAddress = "Billing address is required (at least 3 characters).";
    }
    if (shippingAddress.trim().length < 3) {
      err.shippingAddress = "Shipping address is required (at least 3 characters).";
    }
    const g = buyerGstin.trim();
    if (g && !GSTIN_RE.test(g)) {
      err.buyerGstin = "Enter a valid 15-character GSTIN or leave the field empty.";
    }
    if (!releaseDate) err.releaseDate = "Set PO release date using Year / Month / Day, then the button.";
    if (!expiryDate) err.expiryDate = "Set PO expiry date using Year / Month / Day, then the button.";
    if (releaseDate && expiryDate && expiryDate < releaseDate) {
      err.expiryDate = "Expiry date must be on or after the release date.";
    }
    if (!poType) err.poType = "Select PO type.";
    if (files.length !== 2) {
      err.poFiles = "Choose exactly two files: one PDF and one spreadsheet (CSV or Excel).";
    } else {
      const pdfN = files.filter((f) => classifyPoUploadLocal(f) === "pdf").length;
      const ssN = files.filter((f) => classifyPoUploadLocal(f) === "spreadsheet").length;
      if (pdfN !== 1 || ssN !== 1) {
        err.poFiles = "Provide one PDF and one spreadsheet or CSV (one of each, max 2MB per file).";
      }
      for (const f of files) {
        if (classifyPoUploadLocal(f) === "other") {
          err.poFiles = `Unsupported type: ${f.name}. Use PDF or Excel/CSV only.`;
          break;
        }
        if (f.size > 2 * 1024 * 1024) {
          err.poFiles = `File "${f.name}" exceeds the 2MB limit.`;
          break;
        }
      }
    }
    setFieldErrors(err);
    return Object.keys(err).length === 0;
  }, [
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
    files,
  ]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    if (!validateForm()) return;
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
      for (const f of files) {
        fd.append("po_files", f);
      }
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
      <AppPageTitle
        title="Add New Purchase Order"
        description="Create an outbound PO with buyer details and original PDF + spreadsheet."
      />

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading form…</p>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
          <Card className="border-primary/15 shadow-sm">
            <CardContent className="space-y-8 p-4 sm:p-6">
              {/* Identity */}
              <section className="space-y-3">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold">Identity</h2>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Sold Via lists the two channels from Zap. Companies refresh from the directory on open.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="po-number">PO Number</Label>
                    <Input
                      id="po-number"
                      value={poNumber}
                      onChange={(e) => {
                        setPoNumber(e.target.value);
                        setFieldErrors((p) => {
                          const n = { ...p };
                          delete n.poNumber;
                          return n;
                        });
                      }}
                      className="min-h-11"
                      placeholder="Buyer's PO Number"
                      maxLength={80}
                      aria-invalid={!!fieldErrors.poNumber}
                    />
                    {fieldErrors.poNumber ? (
                      <p className="text-destructive text-xs">{fieldErrors.poNumber}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label>Sold Via</Label>
                    <SearchableSelect
                      value={soldViaCode}
                      onChange={(v) => {
                        setSoldViaCode(v);
                        setFieldErrors((prev) => {
                          const n = { ...prev };
                          delete n.soldVia;
                          return n;
                        });
                      }}
                      options={soldViaOptions}
                      placeholder="Select Sold Via"
                      emptyText="No sold-via options"
                      variant="soft"
                    />
                    {fieldErrors.soldVia ? (
                      <p className="text-destructive text-xs">{fieldErrors.soldVia}</p>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        Typically Eunoia or Intellozene.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Company</Label>
                    <SearchableSelect
                      value={companyId}
                      onChange={(v) => {
                        setCompanyId(v);
                        setFieldErrors((prev) => {
                          const n = { ...prev };
                          delete n.company;
                          return n;
                        });
                      }}
                      options={companyOptions}
                      placeholder="Select Company"
                      emptyText="No companies in Zap yet — check sync credentials and refresh."
                    />
                    {fieldErrors.company ? (
                      <p className="text-destructive text-xs">{fieldErrors.company}</p>
                    ) : selectedCompany ? (
                      <p className="text-muted-foreground text-xs">
                        {selectedCompanyDescription ?? "No description stored for this company."}
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        Buyer / marketplace this PO is for.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="po-loc">PO Location</Label>
                    <Input
                      id="po-loc"
                      value={poLocation}
                      onChange={(e) => {
                        setPoLocation(e.target.value);
                        setFieldErrors((p) => {
                          const n = { ...p };
                          delete n.poLocation;
                          return n;
                        });
                      }}
                      className="min-h-11"
                      placeholder="PO Location"
                      minLength={2}
                      aria-invalid={!!fieldErrors.poLocation}
                    />
                    {fieldErrors.poLocation ? (
                      <p className="text-destructive text-xs">{fieldErrors.poLocation}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label>PO Type</Label>
                    <SearchableSelect
                      value={poType}
                      onChange={(v) => {
                        setPoType(v);
                        setFieldErrors((p) => {
                          const n = { ...p };
                          delete n.poType;
                          return n;
                        });
                      }}
                      options={poTypeOptions}
                      placeholder="Select PO Type"
                      emptyText="No PO types"
                      variant="soft"
                    />
                    {fieldErrors.poType ? (
                      <p className="text-destructive text-xs">{fieldErrors.poType}</p>
                    ) : null}
                  </div>
                </div>
              </section>

              {/* Dates */}
              <section className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold">Dates</h2>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Set release and expiry with Year / Month / Day, then the Set button.
                  </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-1">
                    <TripletDatePicker
                      title="Select PO Release date"
                      value={releaseDate}
                      onSet={(d) => {
                        setReleaseDate(d);
                        setFieldErrors((p) => {
                          const n = { ...p };
                          delete n.releaseDate;
                          delete n.expiryDate;
                          return n;
                        });
                      }}
                      setButtonLabel="Set PO Release date"
                    />
                    {fieldErrors.releaseDate ? (
                      <p className="text-destructive px-1 text-xs">{fieldErrors.releaseDate}</p>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <TripletDatePicker
                      title="Select PO expiry date"
                      value={expiryDate}
                      onSet={(d) => {
                        setExpiryDate(d);
                        setFieldErrors((p) => {
                          const n = { ...p };
                          delete n.expiryDate;
                          return n;
                        });
                      }}
                      setButtonLabel="Set PO expiry date"
                    />
                    {fieldErrors.expiryDate ? (
                      <p className="text-destructive px-1 text-xs">{fieldErrors.expiryDate}</p>
                    ) : null}
                  </div>
                </div>
              </section>

              {/* Buyer */}
              <section className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold">Buyer</h2>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Addresses appear on the PO detail page and help Ops dispatch correctly.
                  </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bill">Billing Address</Label>
                    <textarea
                      id="bill"
                      value={billingAddress}
                      onChange={(e) => {
                        setBillingAddress(e.target.value);
                        setFieldErrors((p) => {
                          const n = { ...p };
                          delete n.billingAddress;
                          return n;
                        });
                      }}
                      className={textareaClass}
                      placeholder="Billing Address"
                      minLength={3}
                      aria-invalid={!!fieldErrors.billingAddress}
                    />
                    {fieldErrors.billingAddress ? (
                      <p className="text-destructive text-xs">{fieldErrors.billingAddress}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ship">Shipping Address</Label>
                    <textarea
                      id="ship"
                      value={shippingAddress}
                      onChange={(e) => {
                        setShippingAddress(e.target.value);
                        setFieldErrors((p) => {
                          const n = { ...p };
                          delete n.shippingAddress;
                          return n;
                        });
                      }}
                      className={textareaClass}
                      placeholder="Shipping Address"
                      minLength={3}
                      aria-invalid={!!fieldErrors.shippingAddress}
                    />
                    {fieldErrors.shippingAddress ? (
                      <p className="text-destructive text-xs">{fieldErrors.shippingAddress}</p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="gstin">Buyer GSTIN</Label>
                    <Input
                      id="gstin"
                      value={buyerGstin}
                      onChange={(e) => {
                        setBuyerGstin(e.target.value.toUpperCase());
                        setFieldErrors((p) => {
                          const n = { ...p };
                          delete n.buyerGstin;
                          return n;
                        });
                      }}
                      className="min-h-11 font-mono uppercase"
                      placeholder="Buyer GSTIN"
                      maxLength={15}
                      aria-invalid={!!fieldErrors.buyerGstin}
                    />
                    {fieldErrors.buyerGstin ? (
                      <p className="text-destructive text-xs">{fieldErrors.buyerGstin}</p>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        Optional. If filled, must be a valid 15-character GSTIN.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* Documents */}
              <section className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold">Original PO documents</h2>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    Upload exactly two files: <strong>one PDF</strong> and <strong>one spreadsheet</strong> (CSV/Excel),
                    each up to <strong>2MB</strong>. These appear on the PO detail page under{" "}
                    <strong>Original PO documents</strong>.{" "}
                    <Link
                      href="/samples/outbound/sample_po_line_items_spreadsheet.csv?v=2"
                      className="text-primary font-medium underline-offset-2 hover:underline"
                      download
                    >
                      Download sample spreadsheet
                    </Link>
                    .
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="po-files">Upload files</Label>
                  <Input
                    id="po-files"
                    type="file"
                    accept=".pdf,.csv,.xlsx,.xls,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    multiple
                    className="min-h-11 cursor-pointer"
                    aria-invalid={!!fieldErrors.poFiles}
                    onChange={(e) => {
                      const list = e.target.files ? Array.from(e.target.files) : [];
                      if (list.length > 2) {
                        toast.message("Only two files are used", {
                          description: "Select one PDF and one spreadsheet.",
                        });
                      }
                      setFiles(list.slice(0, 2));
                      setFieldErrors((p) => {
                        const n = { ...p };
                        delete n.poFiles;
                        return n;
                      });
                      e.target.value = "";
                    }}
                  />
                  {fieldErrors.poFiles ? (
                    <p className="text-destructive text-xs">{fieldErrors.poFiles}</p>
                  ) : null}
                  {files.length > 0 ? (
                    <ul className="text-muted-foreground font-mono text-xs">
                      {files.map((f) => (
                        <li key={f.name}>
                          {f.name} ({Math.round(f.size / 1024)} KB)
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </section>
            </CardContent>
          </Card>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
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
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Create purchase order"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
