"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { apiUrl, getStoredToken } from "@/lib/api-browser";
import { useAuth } from "@/contexts/auth-context";
import { AppPageTitle } from "@/components/layout/app-page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OUTBOUND_PO_TYPES } from "@/lib/outbound-po-types";
import { cn } from "@/lib/utils";

const textareaClass =
  "border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[100px] w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

type SoldViaOpt = { code: string; label: string };
type CompanyOpt = { id: number; name: string | null; description: string | null };

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  emptyText = "No matches",
}: {
  value: string | null;
  onChange: (key: string) => void;
  options: { key: string; label: string }[];
  placeholder: string;
  emptyText?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [mounted, setMounted] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [panelBox, setPanelBox] = React.useState({ top: 0, left: 0, width: 0 });

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const updatePanelPosition = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPanelBox({
      top: r.bottom + 4,
      left: r.left,
      width: r.width,
    });
  }, []);

  React.useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
  }, [open, options.length, updatePanelPosition]);

  React.useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePanelPosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updatePanelPosition]);

  React.useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const selected = options.find((o) => o.key === value);
  const qTrim = q.trim().toLowerCase();
  const filtered = options.filter((o) => o.label.toLowerCase().includes(qTrim));

  const dropdown = open && mounted ? (
    <div
      ref={panelRef}
      role="listbox"
      className="bg-background text-foreground border-border fixed z-[500] max-h-[min(280px,calc(100vh-24px))] overflow-hidden rounded-md border p-2 shadow-lg"
      style={{
        top: panelBox.top,
        left: panelBox.left,
        width: Math.max(panelBox.width, 200),
      }}
    >
      <Input
        placeholder="Filter options..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-2 h-9 w-full"
        autoFocus
        onKeyDown={(e) => e.stopPropagation()}
      />
      <div
        className="max-h-[200px] overflow-y-auto overflow-x-hidden"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {filtered.length === 0 ? (
          <p className="text-muted-foreground px-2 py-2 text-sm">{emptyText}</p>
        ) : (
          <div className="flex flex-col gap-px py-0.5">
            {filtered.map((o) => (
              <button
                key={o.key}
                type="button"
                role="option"
                aria-selected={value === o.key}
                className={cn(
                  "hover:bg-muted rounded px-2 py-2 text-left text-sm font-medium",
                  value === o.key && "bg-muted/80"
                )}
                onClick={() => {
                  onChange(o.key);
                  setOpen(false);
                  setQ("");
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          "bg-primary text-primary-foreground flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-4 py-2 text-left text-sm font-medium shadow-sm",
          "hover:bg-primary/90",
          open && "ring-ring ring-2 ring-offset-2 ring-offset-background"
        )}
        onClick={() => {
          setOpen((prev) => !prev);
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 opacity-90 transition-transform", open && "rotate-180")}
        />
      </button>
      {dropdown && typeof document !== "undefined"
        ? createPortal(dropdown, document.body)
        : null}
    </div>
  );
}

function TripletDateSection({
  title,
  value,
  onSet,
  setButtonLabel,
}: {
  title: string;
  value: Date | null;
  onSet: (d: Date) => void;
  setButtonLabel: string;
}) {
  const now = new Date();
  const [y, setY] = React.useState(now.getFullYear());
  const [m, setM] = React.useState(now.getMonth());
  const [d, setD] = React.useState(now.getDate());

  const dim = daysInMonth(y, m);
  React.useEffect(() => {
    if (d > dim) setD(dim);
  }, [y, m, dim, d]);

  const years = React.useMemo(() => {
    const cy = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => cy - 1 + i);
  }, []);

  const dayOptions = React.useMemo(() => {
    return Array.from({ length: dim }, (_, i) => i + 1);
  }, [dim]);

  return (
    <Card className="border-border shadow-sm">
      <CardContent className="space-y-3 pt-4">
        <p className="text-sm font-medium">
          {title}:{" "}
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {value
              ? value.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "Not Selected"}
          </span>
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Year</Label>
            <select
              className="border-input bg-background h-10 min-w-[100px] rounded-md border px-2 text-sm"
              value={y}
              onChange={(e) => setY(Number(e.target.value))}
            >
              {years.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Month</Label>
            <select
              className="border-input bg-background h-10 min-w-[140px] rounded-md border px-2 text-sm"
              value={m}
              onChange={(e) => setM(Number(e.target.value))}
            >
              {MONTHS.map((name, idx) => (
                <option key={name} value={idx}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Day</Label>
            <select
              className="border-input bg-background h-10 min-w-[72px] rounded-md border px-2 text-sm"
              value={d}
              onChange={(e) => setD(Number(e.target.value))}
            >
              {dayOptions.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="outline"
            className="ml-auto border-primary text-primary hover:bg-primary/5"
            onClick={() => {
              const local = new Date(y, m, d);
              if (
                local.getFullYear() !== y ||
                local.getMonth() !== m ||
                local.getDate() !== d
              ) {
                toast.error("Invalid calendar date for the selected month.");
                return;
              }
              onSet(new Date(Date.UTC(y, m, d, 12, 0, 0)));
              toast.success(`${title} saved`);
            }}
          >
            {setButtonLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

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
  const [poLocation, setPoLocation] = React.useState("");
  const [billingAddress, setBillingAddress] = React.useState("");
  const [shippingAddress, setShippingAddress] = React.useState("");
  const [buyerGstin, setBuyerGstin] = React.useState("");
  const [releaseDate, setReleaseDate] = React.useState<Date | null>(null);
  const [expiryDate, setExpiryDate] = React.useState<Date | null>(null);
  const [poType, setPoType] = React.useState<string | null>(null);
  const [files, setFiles] = React.useState<File[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  const loadOptions = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/outbound/form-options");
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      const data = (await res.json()) as {
        soldVia: SoldViaOpt[];
        companies: CompanyOpt[];
      };
      setSoldVia(data.soldVia ?? []);
      setCompanies(data.companies ?? []);
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
  }));
  const poTypeOptions = OUTBOUND_PO_TYPES.map((t) => ({ key: t, label: t }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("soldViaCode", soldViaCode ?? "");
      fd.set("companyId", companyId ?? "");
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
    <div className="mx-auto max-w-3xl space-y-6 px-2 py-4 md:px-4">
      <AppPageTitle
        title="Add New Purchase Order"
        description="Sold Via is Eunoia or Intellozene only. Companies are loaded from Zap’s database (populate with npm run sync:outbound-companies). Set release and expiry with Year / Month / Day, then Set. Upload original PO files (PDF and/or spreadsheet, max 2 × 2MB)."
      />

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading form…</p>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
          <div className="space-y-2">
            <Label>Select Sold Via</Label>
            <SearchableSelect
              value={soldViaCode}
              onChange={setSoldViaCode}
              options={soldViaOptions}
              placeholder="Select Sold Via"
              emptyText="No sold-via options"
            />
          </div>

          <div className="space-y-2">
            <Label>Select Company</Label>
            <SearchableSelect
              value={companyId}
              onChange={setCompanyId}
              options={companyOptions}
              placeholder="Select Company"
              emptyText="No companies in database — run npm run sync:outbound-companies, then refresh this page"
            />
            {companyId ? (
              <p className="text-muted-foreground text-xs">
                {companies.find((c) => String(c.id) === companyId)?.description ??
                  "No description stored for this company."}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="po-loc">PO Location</Label>
            <Input
              id="po-loc"
              value={poLocation}
              onChange={(e) => setPoLocation(e.target.value)}
              className="min-h-11"
              placeholder="City / warehouse / location"
              required
              minLength={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bill">Billing Address</Label>
            <textarea
              id="bill"
              value={billingAddress}
              onChange={(e) => setBillingAddress(e.target.value)}
              className={textareaClass}
              placeholder="Billing address"
              required
              minLength={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ship">Shipping Address</Label>
            <textarea
              id="ship"
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              className={textareaClass}
              placeholder="Shipping address"
              required
              minLength={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gstin">Buyer GSTIN</Label>
            <Input
              id="gstin"
              value={buyerGstin}
              onChange={(e) => setBuyerGstin(e.target.value.toUpperCase())}
              className="min-h-11 font-mono uppercase"
              placeholder="15-character GSTIN (optional unless you fill it)"
              maxLength={15}
            />
          </div>

          <TripletDateSection
            title="Select PO Release date"
            value={releaseDate}
            onSet={setReleaseDate}
            setButtonLabel="Set PO Release date"
          />

          <TripletDateSection
            title="Select PO expiry date"
            value={expiryDate}
            onSet={setExpiryDate}
            setButtonLabel="Set PO expiry date"
          />

          <div className="space-y-2">
            <Label>Select PO Type</Label>
            <SearchableSelect
              value={poType}
              onChange={setPoType}
              options={poTypeOptions}
              placeholder="Select PO Type"
              emptyText="No PO types"
            />
          </div>

          <Card className="border-border shadow-sm">
            <CardContent className="space-y-3 pt-4">
              <Label htmlFor="po-files">Upload Original PO files</Label>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Maximum 2 files. Each file must be 2MB or less. Upload the PDF and a spreadsheet
                (or CSV) version of the PO where applicable.{" "}
                <Link
                  href="/samples/outbound/sample_po_line_items_spreadsheet.csv"
                  className="text-primary font-medium underline-offset-2 hover:underline"
                  download
                >
                  Download sample spreadsheet (CSV)
                </Link>{" "}
                for line-item layout.
              </p>
              <Input
                id="po-files"
                type="file"
                accept=".pdf,.csv,.xlsx,.xls,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                multiple
                className="min-h-11 cursor-pointer"
                onChange={(e) => {
                  const list = e.target.files ? Array.from(e.target.files) : [];
                  setFiles(list.slice(0, 2));
                }}
              />
              {files.length > 0 ? (
                <ul className="text-muted-foreground font-mono text-xs">
                  {files.map((f) => (
                    <li key={f.name}>
                      {f.name} ({Math.round(f.size / 1024)} KB)
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex justify-center pt-2">
            <Button
              type="submit"
              size="lg"
              className="bg-primary min-w-[200px] px-8"
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
