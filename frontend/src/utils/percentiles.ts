/** P10-large quantiles — aligned with engine PERCENTILE_QUANTILES. */

const QUANTILES: Record<string, number> = {
  P99: 0.01,
  P90: 0.1,
  P50: 0.5,
  P10: 0.9,
  P01: 0.99,
}

function linearQuantile(sorted: number[], q: number): number {
  const n = sorted.length
  if (n === 0) return 0
  if (n === 1) return sorted[0]
  const pos = (n - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]
  const w = pos - lo
  return sorted[lo] * (1 - w) + sorted[hi] * w
}

export interface AreaPercentiles {
  p99: number
  p90: number
  p50: number
  p10: number
  p01: number
  mean: number
}

export function computePercentiles(values: number[]): AreaPercentiles {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b)
  const n = sorted.length
  const mean = n ? sorted.reduce((a, b) => a + b, 0) / n : 0
  return {
    p99: linearQuantile(sorted, QUANTILES.P99),
    p90: linearQuantile(sorted, QUANTILES.P90),
    p50: linearQuantile(sorted, QUANTILES.P50),
    p10: linearQuantile(sorted, QUANTILES.P10),
    p01: linearQuantile(sorted, QUANTILES.P01),
    mean,
  }
}

/** Workbook cumulative-probability axis labels (P01 at top). */
export const CUMULATIVE_PROB_TICKS: { label: string; p: number }[] = [
  { label: 'P01', p: 0.01 },
  { label: 'P02', p: 0.02 },
  { label: 'P05', p: 0.05 },
  { label: 'P10', p: 0.1 },
  { label: 'P20', p: 0.2 },
  { label: 'P30', p: 0.3 },
  { label: 'P40', p: 0.4 },
  { label: 'P50', p: 0.5 },
  { label: 'P60', p: 0.6 },
  { label: 'P70', p: 0.7 },
  { label: 'P80', p: 0.8 },
  { label: 'P90', p: 0.9 },
  { label: 'P95', p: 0.95 },
  { label: 'P98', p: 0.98 },
  { label: 'P99', p: 0.99 },
]

export function buildCumulativeCurve(values: number[]): { value: number; cumulative: number }[] {
  if (!values.length) return []
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  return sorted.map((value, i) => ({
    value,
    cumulative: (i + 0.5) / n,
  }))
}
