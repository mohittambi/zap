"use client";

import * as React from "react";
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
  onClose,
  onSave,
  onClear,
}: {
  open: boolean;
  initial: CardFilters | undefined;
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

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Filter this card</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
              Company
            </span>
            <select
              value={companyId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setCompanyId(v === "" ? null : Number(v));
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Inherit page filter</option>
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
          </p>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onClear();
              onClose();
            }}
          >
            Clear filter
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave}>
              Apply
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
