"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api-browser";
import type { ParamSpec } from "@/server/queries/homeSavedQueries";

type Company = { id: number; name: string };

function defaultDateValue(d: ParamSpec & { type: "date" }): string {
  const today = new Date();
  if (d.default === "30d_ago") today.setUTCDate(today.getUTCDate() - 30);
  if (d.default === "90d_ago") today.setUTCDate(today.getUTCDate() - 90);
  if (d.default === "365d_ago") today.setUTCDate(today.getUTCDate() - 365);
  return today.toISOString().slice(0, 10);
}

export function buildInitialParams(specs: ParamSpec[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of specs) {
    if (p.type === "date") out[p.name] = defaultDateValue(p);
    else out[p.name] = "";
  }
  return out;
}

export function DynamicParamForm({
  specs,
  values,
  onChange,
}: {
  specs: ParamSpec[];
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const [companies, setCompanies] = React.useState<Company[] | null>(null);
  const needsCompanies = specs.some((p) => p.type === "company");

  React.useEffect(() => {
    if (!needsCompanies || companies != null) return;
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
  }, [needsCompanies, companies]);

  function update(name: string, v: string) {
    onChange({ ...values, [name]: v });
  }

  if (specs.length === 0) {
    return <p className="text-muted-foreground text-xs">No parameters needed.</p>;
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {specs.map((p) => {
        const id = `param-${p.name}`;
        if (p.type === "date") {
          return (
            <label key={p.name} htmlFor={id} className="flex flex-col gap-1">
              <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                {p.label}
              </span>
              <input
                id={id}
                type="date"
                value={values[p.name] ?? ""}
                onChange={(e) => update(p.name, e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              />
            </label>
          );
        }
        if (p.type === "company") {
          return (
            <label key={p.name} htmlFor={id} className="flex flex-col gap-1">
              <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                {p.label}
              </span>
              <select
                id={id}
                value={values[p.name] ?? ""}
                onChange={(e) => update(p.name, e.target.value)}
                className="h-9 min-w-44 rounded-md border border-input bg-background px-2 text-sm"
                disabled={companies == null}
              >
                <option value="">Any</option>
                {(companies ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        // select
        return (
          <label key={p.name} htmlFor={id} className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
              {p.label}
            </span>
            <select
              id={id}
              value={values[p.name] ?? ""}
              onChange={(e) => update(p.name, e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">—</option>
              {p.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}
