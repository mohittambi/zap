"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api-browser";

type Company = { id: number; name: string };

export function HomeFilters({
  companyId,
  onCompanyChange,
}: {
  companyId: number | null;
  onCompanyChange: (id: number | null) => void;
}) {
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<{ companies: Company[] }>("/api/home/companies");
        if (!cancelled) setCompanies(res.companies);
      } catch {
        if (!cancelled) setCompanies([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
          Company
        </span>
        <select
          disabled={loading}
          value={companyId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onCompanyChange(v === "" ? null : Number(v));
          }}
          className="h-9 min-w-48 rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="" className="bg-background text-foreground">
            All companies
          </option>
          {companies.map((c) => (
            <option key={c.id} value={c.id} className="bg-background text-foreground">
              {c.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
