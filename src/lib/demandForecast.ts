export type ForecastMethod = "moving_average" | "exponential_smoothing" | "seasonal_naive";

export type ForecastResult = {
  method: ForecastMethod;
  horizon: number;
  forecast: number[];
  mape: number;
  history: number[];
};

function mape(actual: number[], predicted: number[]): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] === 0) continue;
    sum += Math.abs((actual[i] - predicted[i]) / actual[i]);
    n++;
  }
  return n === 0 ? Infinity : (sum / n) * 100;
}

function movingAverage(series: number[], window: number, horizon: number): number[] {
  const w = Math.min(window, series.length);
  const slice = series.slice(-w);
  const avg = slice.reduce((s, v) => s + v, 0) / w;
  return Array.from({ length: horizon }, () => avg);
}

function exponentialSmoothing(
  series: number[],
  alpha: number,
  horizon: number
): number[] {
  if (series.length === 0) return Array.from({ length: horizon }, () => 0);
  let level = series[0];
  for (let i = 1; i < series.length; i++) {
    level = alpha * series[i] + (1 - alpha) * level;
  }
  return Array.from({ length: horizon }, () => level);
}

function seasonalNaive(series: number[], season: number, horizon: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < horizon; i++) {
    const idx = series.length - season + (i % season);
    out.push(idx >= 0 ? series[idx] : series[series.length - 1] ?? 0);
  }
  return out;
}

function backtest(
  series: number[],
  predictFn: (train: number[], h: number) => number[]
): number {
  const holdout = Math.min(7, Math.max(1, Math.floor(series.length * 0.2)));
  if (series.length <= holdout + 2) return Infinity;
  const train = series.slice(0, -holdout);
  const test = series.slice(-holdout);
  const pred = predictFn(train, holdout);
  return mape(test, pred);
}

/** Pick lowest-MAPE method and forecast next `horizon` periods. */
export function forecastDemand(
  series: number[],
  horizon = 7
): ForecastResult {
  const history = series.filter((v) => Number.isFinite(v));
  if (history.length === 0) {
    return {
      method: "moving_average",
      horizon,
      forecast: Array.from({ length: horizon }, () => 0),
      mape: Infinity,
      history: [],
    };
  }

  const candidates: Array<{ method: ForecastMethod; mape: number; forecast: number[] }> = [
    {
      method: "moving_average",
      mape: backtest(history, (t, h) => movingAverage(t, 7, h)),
      forecast: movingAverage(history, 7, horizon),
    },
    {
      method: "exponential_smoothing",
      mape: backtest(history, (t, h) => exponentialSmoothing(t, 0.3, h)),
      forecast: exponentialSmoothing(history, 0.3, horizon),
    },
    {
      method: "seasonal_naive",
      mape: backtest(history, (t, h) => seasonalNaive(t, 7, h)),
      forecast: seasonalNaive(history, 7, horizon),
    },
  ];

  candidates.sort((a, b) => a.mape - b.mape);
  const best = candidates[0];
  return {
    method: best.method,
    horizon,
    forecast: best.forecast.map((v) => Math.max(0, Math.round(v * 100) / 100)),
    mape: best.mape,
    history,
  };
}
