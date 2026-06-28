"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api-browser";
import {
  SUMMARY_PRESET_DAYS,
  computePresetRange,
  detectPreset,
  exclusiveEndFromInclusive,
  inclusiveEndFromExclusive,
  type SummaryDateRange,
  type SummaryPresetDays,
} from "@/lib/dashboard-date-range";

type Company = { id: number; name: string };

const PRESET_LABELS: Record<SummaryPresetDays, string> = {
  7: "Last 7 days",
  30: "Last 30 days",
  90: "Last 90 days",
  365: "Last 365 days",
};

const selectClassName =
  "h-9 min-w-40 rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
const dateInputClassName =
  "h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

export function HomeFilters({
  companyId,
  onCompanyChange,
  dateFrom,
  dateTo,
  onDateChange,
}: {
  companyId: number | null;
  onCompanyChange: (id: number | null) => void;
  dateFrom: string;
  dateTo: string;
  onDateChange: (range: SummaryDateRange) => void;
}) {
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [loading, setLoading] = React.useState(true);

  const preset = React.useMemo(
    () => detectPreset(dateFrom, dateTo),
    [dateFrom, dateTo]
  );
  const [presetValue, setPresetValue] = React.useState<string>(
    preset === "custom" ? "custom" : String(preset)
  );

  React.useEffect(() => {
    setPresetValue(preset === "custom" ? "custom" : String(preset));
  }, [preset]);

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

  function handlePresetChange(value: string) {
    setPresetValue(value);
    if (value === "custom") return;
    const days = Number(value) as SummaryPresetDays;
    if (!SUMMARY_PRESET_DAYS.includes(days)) return;
    onDateChange(computePresetRange(days));
  }

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
          className={`${selectClassName} min-w-48`}
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

      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
          Time range
        </span>
        <select
          value={presetValue}
          onChange={(e) => handlePresetChange(e.target.value)}
          className={selectClassName}
        >
          {SUMMARY_PRESET_DAYS.map((days) => (
            <option key={days} value={String(days)}>
              {PRESET_LABELS[days]}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
      </label>

      {presetValue === "custom" ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
              From
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                const from = e.target.value;
                if (!from) return;
                onDateChange({ from, to: dateTo });
              }}
              className={dateInputClassName}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
              To
            </span>
            <input
              type="date"
              value={inclusiveEndFromExclusive(dateTo)}
              onChange={(e) => {
                const inclusiveTo = e.target.value;
                if (!inclusiveTo) return;
                onDateChange({
                  from: dateFrom,
                  to: exclusiveEndFromInclusive(inclusiveTo),
                });
              }}
              className={dateInputClassName}
            />
          </label>
        </>
      ) : null}
    </div>
  );
}
