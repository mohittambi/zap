"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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

export function formatUtcDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateOnlyString(s: string | null | undefined): Date | null {
  if (!s?.trim()) return null;
  const trimmed = s.trim().replace(" ", "T").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const d = new Date(`${trimmed}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function utcDateFromYmdParts(y: number, m: number, d: number): Date | null {
  const local = new Date(y, m, d);
  if (local.getFullYear() !== y || local.getMonth() !== m || local.getDate() !== d) {
    return null;
  }
  return new Date(Date.UTC(y, m, d, 12, 0, 0));
}

export function TripletDatePicker({
  title,
  value,
  onSet,
  setButtonLabel,
  embedded = false,
  autoCommit = false,
}: {
  title: string;
  value: Date | null;
  onSet: (d: Date) => void;
  setButtonLabel: string;
  /** When true, omits the outer Card (e.g. inside a dialog). */
  embedded?: boolean;
  /** When true, applies the selected Y/M/D as soon as the user changes a dropdown. */
  autoCommit?: boolean;
}) {
  const seed = value ?? new Date();
  const [y, setY] = React.useState(seed.getUTCFullYear());
  const [m, setM] = React.useState(seed.getUTCMonth());
  const [d, setD] = React.useState(seed.getUTCDate());
  const userAdjustedRef = React.useRef(false);

  React.useEffect(() => {
    if (!value) return;
    setY(value.getUTCFullYear());
    setM(value.getUTCMonth());
    setD(value.getUTCDate());
  }, [value]);

  const dim = daysInMonth(y, m);
  React.useEffect(() => {
    if (d > dim) setD(dim);
  }, [y, m, dim, d]);

  const commitSelection = React.useCallback(() => {
    const next = utcDateFromYmdParts(y, m, d);
    if (!next) {
      toast.error("Invalid calendar date for the selected month.");
      return;
    }
    onSet(next);
  }, [y, m, d, onSet]);

  React.useEffect(() => {
    if (!autoCommit || !userAdjustedRef.current) return;
    const next = utcDateFromYmdParts(y, m, d);
    if (!next) return;
    if (value?.getTime() === next.getTime()) return;
    onSet(next);
  }, [autoCommit, y, m, d, value, onSet]);

  const markAdjusted = React.useCallback(() => {
    userAdjustedRef.current = true;
  }, []);

  const years = React.useMemo(() => {
    const cy = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => cy - 1 + i);
  }, []);

  const dayOptions = React.useMemo(() => {
    return Array.from({ length: dim }, (_, i) => i + 1);
  }, [dim]);

  const body = (
    <div className={cn("space-y-3", embedded ? "" : "pt-4")}>
      <p className="text-sm font-medium">
        {title} :{" "}
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value
            ? value.toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
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
            onChange={(e) => {
              markAdjusted();
              setY(Number(e.target.value));
            }}
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
            onChange={(e) => {
              markAdjusted();
              setM(Number(e.target.value));
            }}
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
            onChange={(e) => {
              markAdjusted();
              setD(Number(e.target.value));
            }}
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
          className="border-primary text-primary hover:bg-primary/5 ml-auto"
          onClick={() => {
            markAdjusted();
            commitSelection();
          }}
        >
          {setButtonLabel}
        </Button>
      </div>
    </div>
  );

  if (embedded) return body;

  return (
    <Card className="border-border shadow-sm">
      <CardContent>{body}</CardContent>
    </Card>
  );
}
