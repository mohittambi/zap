export type AbcClass = "A" | "B" | "C";
export type XyzClass = "X" | "Y" | "Z";

export type SkuSegmentInput = {
  sku_id: string;
  value_30d: number;
  demand_series: number[];
};

export type SkuSegment = {
  sku_id: string;
  abc: AbcClass;
  xyz: XyzClass;
  value_30d: number;
  cv: number;
  policy: string;
};

function coefficientOfVariation(series: number[]): number {
  if (series.length < 2) return 0;
  const mean = series.reduce((s, v) => s + v, 0) / series.length;
  if (mean === 0) return 0;
  const variance =
    series.reduce((s, v) => s + (v - mean) ** 2, 0) / series.length;
  return Math.sqrt(variance) / mean;
}

function classifyXyz(cv: number): XyzClass {
  if (cv < 0.5) return "X";
  if (cv < 1.0) return "Y";
  return "Z";
}

function policyFor(abc: AbcClass, xyz: XyzClass): string {
  if (abc === "A" && xyz === "X") return "Tight reorder; high service level";
  if (abc === "A") return "Prioritize availability; monitor closely";
  if (abc === "C" && xyz === "Z") return "Liquidate or minimal stock";
  if (abc === "C") return "Reduce inventory; slow replenishment";
  return "Standard reorder policy";
}

/** ABC by cumulative value (80/15/5), XYZ by demand CV. */
export function classifySkusAbcXyz(inputs: SkuSegmentInput[]): SkuSegment[] {
  const sorted = [...inputs].sort((a, b) => b.value_30d - a.value_30d);
  const total = sorted.reduce((s, r) => s + r.value_30d, 0) || 1;
  let cumulative = 0;

  return sorted.map((row) => {
    cumulative += row.value_30d;
    const pct = (cumulative / total) * 100;
    const abc: AbcClass = pct <= 80 ? "A" : pct <= 95 ? "B" : "C";
    const cv = coefficientOfVariation(row.demand_series);
    const xyz = classifyXyz(cv);
    return {
      sku_id: row.sku_id,
      abc,
      xyz,
      value_30d: row.value_30d,
      cv,
      policy: policyFor(abc, xyz),
    };
  });
}
