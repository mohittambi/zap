"use client";

import * as React from "react";
import { Eraser } from "lucide-react";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CardFilters } from "@/lib/dashboard-card-ids";

type Company = { id: number; name: string };

export function CardFilterForm({
  open,
  initial,
  pageCompanyId,
  onClose,
  onSave,
  onClear,
}: {
  open: boolean;
  initial: CardFilters | undefined;
  /** Page-level company filter — used to label "Inherit page filter" with the actual company. */
  pageCompanyId: number | null;
  onClose: () => void;
  onSave: (filters: CardFilters) => void;
  onClear: () => void;
}) {
  const [companyId, setCompanyId] = React.useState<number | null>(
    initial?.company_id ?? null
  );
  const [from, setFrom] = React.useState<string>(initial?.date_from ?? "");
  const [to, setTo] = React.useState<string>(initial?.date_to ?? "");
  const [companies, setCompanies] = React.useState<Company[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setCompanyId(initial?.company_id ?? null);
    setFrom(initial?.date_from ?? "");
    setTo(initial?.date_to ?? "");
  }, [open, initial]);

  React.useEffect(() => {
    if (!open || companies.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<{ companies: Company[] }>("/api/home/companies");
        if (!cancelled) setCompanies(res.companies);
      } catch {
        if (!cancelled) setCompanies([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, companies.length]);

  function handleSave() {
    const out: CardFilters = {};
    if (companyId != null) out.company_id = companyId;
    if (from) out.date_from = from;
    if (to) out.date_to = to;
    if (Object.keys(out).length === 0) {
      onClear();
    } else {
      onSave(out);
    }
    onClose();
  }

  /** What "Inherit page filter" actually means, surfaced inline so the user
   * doesn't have to guess what they're falling back to. */
  const inheritedCompanyLabel =
    pageCompanyId == null
      ? "All companies (no page filter)"
      : (companies.find((c) => c.id === pageCompanyId)?.name ??
          `Company ${pageCompanyId}`);

  const hasActiveFilter =
    initial != null && Object.keys(initial).length > 0;

  const isClearedInForm = companyId == null && !from && !to;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Filter this card</DialogTitle>
        </DialogHeader>

        {/* Quick clear — always visible at the top, primary destructive action. */}
        {hasActiveFilter ? (
          <div className="border-primary/15 bg-primary/5 flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <span className="text-foreground text-xs">
              This card has a custom filter applied.
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                onClear();
                onClose();
              }}
            >
              <Eraser className="size-3.5" />
              Reset to inherit
            </Button>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground flex items-center justify-between text-[10px] font-medium uppercase tracking-wide">
              <span>Company</span>
              <span className="text-foreground/60 normal-case tracking-normal text-[11px]">
                Inheriting: <span className="font-medium">{inheritedCompanyLabel}</span>
              </span>
            </span>
            <select
              value={companyId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setCompanyId(v === "" ? null : Number(v));
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Inherit ({inheritedCompanyLabel})</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                From
              </span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                To
              </span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              />
            </label>
          </div>
          <p className="text-muted-foreground text-xs">
            Empty fields inherit the page-level filter. The dashboard&apos;s default 30-day window applies if no date range is set anywhere.
            {isClearedInForm
              ? " Clicking Apply with all fields empty will remove this card's custom filter."
              : null}
          </p>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSave}>
            {isClearedInForm ? "Clear filter" : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
