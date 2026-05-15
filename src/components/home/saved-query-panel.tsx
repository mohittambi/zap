"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildInitialParams,
  DynamicParamForm,
} from "@/components/home/dynamic-param-form";
import {
  SavedQueryResult,
  type QueryResultData,
} from "@/components/home/saved-query-result";
import type { ParamSpec, ResultShape } from "@/server/queries/homeSavedQueries";

type SavedQueryMeta = {
  id: string;
  label: string;
  description: string;
  params: ParamSpec[];
  resultShape: ResultShape;
};

export function SavedQueryPanel() {
  const [queries, setQueries] = React.useState<SavedQueryMeta[] | null>(null);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [params, setParams] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<QueryResultData | null>(null);
  const [running, setRunning] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<{ queries: SavedQueryMeta[] }>("/api/home/queries");
        if (cancelled) return;
        setQueries(res.queries);
        const first = res.queries[0];
        if (first) {
          setSelectedId(first.id);
          setParams(buildInitialParams(first.params));
        }
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to load queries");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = React.useMemo(
    () => queries?.find((q) => q.id === selectedId) ?? null,
    [queries, selectedId]
  );

  function handleSelect(id: string) {
    setSelectedId(id);
    const def = queries?.find((q) => q.id === id);
    setParams(def ? buildInitialParams(def.params) : {});
    setResult(null);
  }

  async function run() {
    if (!selected) return;
    setRunning(true);
    setResult(null);
    try {
      // Strip empty optional params so the server treats them as absent.
      const body: Record<string, unknown> = {};
      for (const p of selected.params) {
        const v = params[p.name];
        if (v != null && v !== "") body[p.name] = v;
      }
      const res = await apiFetch<{
        columns: string[];
        rows: unknown[][];
        resultShape: ResultShape;
      }>(`/api/home/queries/${encodeURIComponent(selected.id)}/run`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setResult({
        resultShape: res.resultShape,
        columns: res.columns,
        rows: res.rows,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Query failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {queries == null ? (
        <Skeleton className="h-9 w-72" />
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
              Query
            </span>
            <select
              value={selectedId}
              onChange={(e) => handleSelect(e.target.value)}
              className="h-9 min-w-72 rounded-md border border-input bg-background px-2 text-sm"
            >
              {queries.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {selected ? (
        <>
          <p className="text-muted-foreground text-xs">{selected.description}</p>
          <DynamicParamForm specs={selected.params} values={params} onChange={setParams} />
          <div>
            <Button onClick={run} disabled={running} size="sm">
              {running ? "Running…" : "Run"}
            </Button>
          </div>
        </>
      ) : null}

      {result ? (
        <div className="rounded-lg border">
          <SavedQueryResult result={result} />
        </div>
      ) : null}
    </div>
  );
}
