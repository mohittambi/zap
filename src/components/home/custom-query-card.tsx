"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SavedQueryResult, type QueryResultData } from "@/components/home/saved-query-result";
import {
  QB_MODULES_CLIENT,
  QB_MODULE_MAP,
  DOMAIN_LABELS,
  OPERATORS_BY_TYPE,
  type QBModuleClient,
  type FieldDef,
  type Operator,
} from "@/lib/query-builder-types";

// ── Types ──────────────────────────────────────────────────────────────────────

type ResultShape = "table" | "bar" | "line";

type ConditionRow = {
  id: string;
  field: string;
  op: Operator;
  value: string;
  value2: string;
};

const LIMIT_OPTIONS = [50, 100, 250, 500, 1000, 5000] as const;
type LimitOption = typeof LIMIT_OPTIONS[number];

type SavedState = {
  moduleId: string;
  conditions: ConditionRow[];
  columns: string[];
  resultShape: ResultShape;
  limit: LimitOption;
};

const STORE_KEY = "zap-qb-state";

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function today(): string { return toDateStr(new Date()); }
function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n); return toDateStr(d);
}

function defaultOp(field: FieldDef): Operator {
  if (field.type === "date") return "between";
  return OPERATORS_BY_TYPE[field.type][0].op;
}

function defaultValues(field: FieldDef): { value: string; value2: string } {
  if (field.type === "date") return { value: daysAgo(30), value2: today() };
  return { value: "", value2: "" };
}

function loadSaved(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedState;
  } catch {
    return null;
  }
}

function saveSaved(s: SavedState) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* non-critical */ }
}

// ── Domain grouping ────────────────────────────────────────────────────────────

const DOMAINS = (["outbound", "inbound", "inventory", "masters"] as const).map((d) => ({
  key: d,
  label: DOMAIN_LABELS[d],
  modules: QB_MODULES_CLIENT.filter((m) => m.domain === d),
}));

// ── Sub-components ─────────────────────────────────────────────────────────────

function ConditionValueInput({
  field,
  op,
  value,
  value2,
  onChange,
  onChange2,
}: {
  field: FieldDef;
  op: Operator;
  value: string;
  value2: string;
  onChange: (v: string) => void;
  onChange2: (v: string) => void;
}) {
  if (op === "is_null" || op === "not_null") return null;

  if (field.type === "select" && field.options) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">— pick —</option>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  if (field.type === "date") {
    return (
      <div className="flex items-center gap-1">
        <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-36 text-xs" />
        {op === "between" && (
          <>
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={value2} onChange={(e) => onChange2(e.target.value)} className="h-7 w-36 text-xs" />
          </>
        )}
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div className="flex items-center gap-1">
        <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-24 text-xs" placeholder="value" />
        {op === "between" && (
          <>
            <span className="text-xs text-muted-foreground">and</span>
            <Input type="number" value={value2} onChange={(e) => onChange2(e.target.value)} className="h-7 w-24 text-xs" placeholder="value" />
          </>
        )}
      </div>
    );
  }

  return (
    <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-40 text-xs" placeholder="value" />
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CustomQueryCard() {
  const [selectedModule, setSelectedModule] = React.useState<QBModuleClient | null>(null);
  const [conditions, setConditions] = React.useState<ConditionRow[]>([]);
  const [columns, setColumns] = React.useState<Set<string>>(new Set());
  const [resultShape, setResultShape] = React.useState<ResultShape>("table");
  const [limit, setLimit] = React.useState<LimitOption>(500);
  const [result, setResult] = React.useState<QueryResultData | null>(null);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);

  // Restore saved state on mount
  React.useEffect(() => {
    const saved = loadSaved();
    if (!saved) return;
    const mod = QB_MODULE_MAP.get(saved.moduleId);
    if (!mod) return;
    setSelectedModule(mod);
    setConditions(saved.conditions ?? []);
    setColumns(new Set(saved.columns ?? mod.defaultColumns));
    setResultShape(saved.resultShape ?? "table");
    setLimit(saved.limit ?? 500);
  }, []);

  function persist(
    mod: QBModuleClient | null,
    conds: ConditionRow[],
    cols: Set<string>,
    shape: ResultShape,
    lim: LimitOption,
  ) {
    if (!mod) return;
    saveSaved({ moduleId: mod.id, conditions: conds, columns: [...cols], resultShape: shape, limit: lim });
  }

  // ── Drag-and-drop module selection ─────────────────────────────────────────

  function handleModuleDragStart(e: React.DragEvent, modId: string) {
    e.dataTransfer.setData("qb-module-id", modId);
    e.dataTransfer.effectAllowed = "copy";
  }

  function handleDropZoneDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const modId = e.dataTransfer.getData("qb-module-id");
    const mod = QB_MODULE_MAP.get(modId);
    if (!mod) return;
    selectModule(mod);
  }

  function selectModule(mod: QBModuleClient) {
    const defaultCols = new Set(mod.defaultColumns);
    setSelectedModule(mod);
    setConditions([]);
    setColumns(defaultCols);
    setResult(null);
    setError(null);
    persist(mod, [], defaultCols, resultShape, limit);
  }

  // ── Conditions ──────────────────────────────────────────────────────────────

  function addCondition() {
    if (!selectedModule) return;
    const firstField = selectedModule.fields[0];
    const newRow: ConditionRow = {
      id: uid(),
      field: firstField.name,
      op: defaultOp(firstField),
      ...defaultValues(firstField),
    };
    const next = [...conditions, newRow];
    setConditions(next);
    persist(selectedModule, next, columns, resultShape, limit);
  }

  function updateCondition(id: string, patch: Partial<ConditionRow>) {
    const next = conditions.map((c) => {
      if (c.id !== id) return c;
      const updated = { ...c, ...patch };
      // When field changes, reset op and values to sensible defaults
      if (patch.field && patch.field !== c.field) {
        const field = selectedModule?.fields.find((f) => f.name === patch.field);
        if (field) {
          updated.op = defaultOp(field);
          const dv = defaultValues(field);
          updated.value = dv.value;
          updated.value2 = dv.value2;
        }
      }
      return updated;
    });
    setConditions(next);
    if (selectedModule) persist(selectedModule, next, columns, resultShape, limit);
  }

  function removeCondition(id: string) {
    const next = conditions.filter((c) => c.id !== id);
    setConditions(next);
    if (selectedModule) persist(selectedModule, next, columns, resultShape, limit);
  }

  // ── Columns ─────────────────────────────────────────────────────────────────

  function toggleColumn(name: string) {
    const next = new Set(columns);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setColumns(next);
    if (selectedModule) persist(selectedModule, conditions, next, resultShape, limit);
  }

  function setShape(s: ResultShape) {
    setResultShape(s);
    if (selectedModule) persist(selectedModule, conditions, columns, s, limit);
  }

  function changeLimit(lim: LimitOption) {
    setLimit(lim);
    if (selectedModule) persist(selectedModule, conditions, columns, resultShape, lim);
  }

  // ── Run ─────────────────────────────────────────────────────────────────────

  async function handleRun() {
    if (!selectedModule) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiFetch<{ columns: string[]; rows: unknown[][]; result_shape: ResultShape }>(
        "/api/home/custom-query/run",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            module: selectedModule.id,
            conditions: conditions.map(({ field, op, value, value2 }) => ({ field, op, value, value2 })),
            columns: [...columns],
            result_shape: resultShape,
            limit,
          }),
        }
      );
      setResult({ resultShape: data.result_shape, columns: data.columns, rows: data.rows });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Query failed");
    } finally {
      setRunning(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-[340px] flex-col gap-0">
      <div className="flex flex-1 gap-0 divide-x divide-border">

        {/* ── Module palette ── */}
        <div className="w-48 shrink-0 overflow-y-auto pr-3 pt-1">
          {DOMAINS.map((domain) => (
            <div key={domain.key} className="mb-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {domain.label}
              </p>
              <div className="flex flex-col gap-1">
                {domain.modules.map((mod) => (
                  <div
                    key={mod.id}
                    draggable
                    onDragStart={(e) => handleModuleDragStart(e, mod.id)}
                    onClick={() => selectModule(mod)}
                    className={`flex cursor-grab items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors active:cursor-grabbing ${
                      selectedModule?.id === mod.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted"
                    }`}
                  >
                    <span>{mod.icon}</span>
                    <span>{mod.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Builder panel ── */}
        <div className="flex flex-1 flex-col gap-4 pl-4 pt-1">
          {!selectedModule ? (
            /* Drop zone — empty state */
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDropZoneDrop}
              className={`flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                isDragOver ? "border-primary bg-primary/5" : "border-border bg-muted/30"
              }`}
            >
              <p className="text-sm font-medium text-muted-foreground">
                {isDragOver ? "Drop to select" : "Drag a module here to start"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">or click any module on the left</p>
            </div>
          ) : (
            <>
              {/* Selected module chip + drop zone overlay */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDropZoneDrop}
                className={`flex items-center gap-2 rounded-md border px-3 py-1.5 transition-colors ${
                  isDragOver ? "border-primary bg-primary/5" : "border-border bg-muted/40"
                }`}
              >
                <span className="text-base">{selectedModule.icon}</span>
                <span className="text-sm font-semibold">{selectedModule.label}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">drop another module to swap</span>
              </div>

              {/* Conditions */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filters</p>
                  <button
                    onClick={addCondition}
                    className="flex items-center gap-1 rounded-md border border-dashed border-primary/50 px-2 py-0.5 text-xs text-primary hover:bg-primary/5"
                  >
                    + Add filter
                  </button>
                </div>

                {conditions.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No filters — all rows returned (max 500)</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {conditions.map((cond) => {
                      const field = selectedModule.fields.find((f) => f.name === cond.field)!;
                      const validOps = field ? OPERATORS_BY_TYPE[field.type] : [];
                      return (
                        <div key={cond.id} className="flex flex-wrap items-center gap-2">
                          {/* Field selector */}
                          <select
                            value={cond.field}
                            onChange={(e) => updateCondition(cond.id, { field: e.target.value })}
                            className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            {selectedModule.fields.map((f) => (
                              <option key={f.name} value={f.name}>{f.label}</option>
                            ))}
                          </select>

                          {/* Operator selector */}
                          <select
                            value={cond.op}
                            onChange={(e) => updateCondition(cond.id, { op: e.target.value as Operator })}
                            className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            {validOps.map(({ op, label }) => (
                              <option key={op} value={op}>{label}</option>
                            ))}
                          </select>

                          {/* Value input */}
                          {field ? (
                            <ConditionValueInput
                              field={field}
                              op={cond.op}
                              value={cond.value}
                              value2={cond.value2}
                              onChange={(v) => updateCondition(cond.id, { value: v })}
                              onChange2={(v) => updateCondition(cond.id, { value2: v })}
                            />
                          ) : null}

                          {/* Remove */}
                          <button
                            onClick={() => removeCondition(cond.id)}
                            className="ml-auto text-muted-foreground hover:text-destructive"
                            aria-label="Remove filter"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Column picker */}
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Columns</p>
                <div className="flex flex-wrap gap-2">
                  {selectedModule.fields.map((f) => {
                    const checked = columns.has(f.name);
                    return (
                      <button
                        key={f.name}
                        onClick={() => toggleColumn(f.name)}
                        className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* View as + Limit + Run */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex overflow-hidden rounded-md border border-input">
                  {(["table", "bar", "line"] as ResultShape[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setShape(s)}
                      className={`px-3 py-1 text-xs font-medium capitalize transition-colors ${
                        resultShape === s
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Max rows</span>
                  <select
                    value={limit}
                    onChange={(e) => changeLimit(Number(e.target.value) as LimitOption)}
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {LIMIT_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n.toLocaleString()}</option>
                    ))}
                  </select>
                </div>

                <Button
                  size="sm"
                  onClick={() => void handleRun()}
                  disabled={running || columns.size === 0}
                  className="h-7 px-4"
                >
                  {running ? "Running…" : "Run ▶"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error ? (
        <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      ) : null}

      {/* Results */}
      {result ? (
        <div className="mt-4 border-t pt-4">
          <SavedQueryResult result={result} />
        </div>
      ) : null}
    </div>
  );
}
