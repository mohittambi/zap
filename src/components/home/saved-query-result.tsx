"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatIstDate,
  formatIstDateTime,
  formatIstShortDay,
  looksLikeIsoDay,
  looksLikeIsoTimestamp,
} from "@/lib/format-ist";
import type { ResultShape } from "@/server/queries/homeSavedQueries";

export type QueryResultData = {
  resultShape: ResultShape;
  columns: string[];
  rows: unknown[][];
};

function formatCell(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return new Intl.NumberFormat("en-IN").format(v);
  if (looksLikeIsoDay(v)) return formatIstDate(v);
  if (looksLikeIsoTimestamp(v)) return formatIstDateTime(v);
  return String(v);
}

function compareCell(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function SortableTable({ columns, rows }: { columns: string[]; rows: unknown[][] }) {
  const [sortCol, setSortCol] = React.useState<number | null>(null);
  const [sortAsc, setSortAsc] = React.useState(true);

  function handleSort(idx: number) {
    if (sortCol === idx) setSortAsc((p) => !p);
    else { setSortCol(idx); setSortAsc(true); }
  }

  const sorted = React.useMemo(() => {
    if (sortCol === null) return rows;
    return [...rows].sort((a, b) => {
      const cmp = compareCell(a[sortCol], b[sortCol]);
      return sortAsc ? cmp : -cmp;
    });
  }, [rows, sortCol, sortAsc]);

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          {columns.map((c, i) => (
            <TableHead
              key={c}
              className="cursor-pointer select-none whitespace-nowrap"
              onClick={() => handleSort(i)}
            >
              {c}
              {sortCol === i ? (
                <span className="ml-1 text-primary">{sortAsc ? "↑" : "↓"}</span>
              ) : (
                <span className="ml-1 text-muted-foreground/40">↕</span>
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((row, i) => (
          <TableRow key={i}>
            {row.map((v, j) => (
              <TableCell
                key={j}
                className={typeof v === "number" ? "tabular-nums" : undefined}
              >
                {formatCell(v)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function SavedQueryResult({ result }: { result: QueryResultData }) {
  if (result.rows.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-xs">No rows.</p>
    );
  }

  if (result.resultShape === "table") {
    return <SortableTable columns={result.columns} rows={result.rows} />;
  }

  // For charts we expect: column[0] = label, column[1] = numeric value.
  const data = result.rows.map((row) => ({
    label: String(row[0]),
    value: Number(row[1]),
  }));
  const labelsAreDays = data.length > 0 && data.every((d) => looksLikeIsoDay(d.label));
  const formatLabel = labelsAreDays ? formatIstShortDay : (s: string) => s;
  const formatTooltipLabel = labelsAreDays ? formatIstDate : (s: string) => s;

  if (result.resultShape === "line") {
    return (
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={28}
              tickFormatter={formatLabel}
            />
            <YAxis tick={{ fontSize: 11 }} width={48} />
            <Tooltip
              contentStyle={{ fontSize: 12 }}
              labelFormatter={(label) => formatTooltipLabel(String(label))}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={result.columns[1]}
              stroke="var(--primary)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // bar
  return (
    <div className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={140} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="value" name={result.columns[1]} fill="var(--primary)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
