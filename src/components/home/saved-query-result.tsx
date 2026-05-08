"use client";

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
import type { ResultShape } from "@/server/queries/homeSavedQueries";

export type QueryResultData = {
  resultShape: ResultShape;
  columns: string[];
  rows: unknown[][];
};

function formatCell(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return new Intl.NumberFormat("en-IN").format(v);
  return String(v);
}

export function SavedQueryResult({ result }: { result: QueryResultData }) {
  if (result.rows.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-xs">No rows.</p>
    );
  }

  if (result.resultShape === "table") {
    return (
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {result.columns.map((c) => (
              <TableHead key={c}>{c}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.rows.map((row, i) => (
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

  // For charts we expect: column[0] = label, column[1] = numeric value.
  const data = result.rows.map((row) => ({
    label: String(row[0]),
    value: Number(row[1]),
  }));

  if (result.resultShape === "line") {
    return (
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={28} />
            <YAxis tick={{ fontSize: 11 }} width={48} />
            <Tooltip contentStyle={{ fontSize: 12 }} />
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
