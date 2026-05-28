import type { PercentileSummary } from '../types/api'

export interface HistogramBin {
  binStart: number
  binEnd: number
  count: number
  label: string
}

export interface ExceedancePoint {
  value: number
  exceedance: number
}

export interface PercentilePoint {
  label: string
  value: number
}

export function buildHistogram(values: number[], binCount = 40): HistogramBin[] {
  if (!values.length) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) {
    return [{ binStart: min, binEnd: max, count: values.length, label: String(min) }]
  }
  const width = (max - min) / binCount
  const counts = new Array(binCount).fill(0)
  for (const v of values) {
    let idx = Math.floor((v - min) / width)
    if (idx >= binCount) idx = binCount - 1
    counts[idx]++
  }
  return counts.map((count, i) => {
    const binStart = min + i * width
    const binEnd = i === binCount - 1 ? max : min + (i + 1) * width
    return {
      binStart,
      binEnd,
      count,
      label: `${binStart.toPrecision(3)}`,
    }
  })
}

/** P(X ≥ x) vs x — matches workbook exceedance / P99–P01 views (P10-large). */
export function buildExceedance(values: number[]): ExceedancePoint[] {
  if (!values.length) return []
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  return sorted.map((value, i) => ({
    value,
    exceedance: (n - i - 0.5) / n,
  }))
}

export function percentileProfileFromSummary(
  summary: PercentileSummary,
): PercentilePoint[] {
  return [
    { label: 'P99', value: summary.p99 },
    { label: 'P90', value: summary.p90 },
    { label: 'P50', value: summary.p50 },
    { label: 'Mean', value: summary.mean_trimmed },
    { label: 'P10', value: summary.p10 },
    { label: 'P01', value: summary.p01 },
  ]
}

export function percentileMarkersFromSummary(summary: PercentileSummary) {
  return [
    { key: 'P90', value: summary.p90, prob: 0.9 },
    { key: 'P50', value: summary.p50, prob: 0.5 },
    { key: 'P10', value: summary.p10, prob: 0.1 },
  ]
}

export function downsampleScatter(
  xs: number[],
  ys: number[],
  maxPoints = 2500,
): { x: number; y: number }[] {
  const n = Math.min(xs.length, ys.length)
  if (n <= maxPoints) {
    return Array.from({ length: n }, (_, i) => ({ x: xs[i], y: ys[i] }))
  }
  const step = Math.ceil(n / maxPoints)
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < n; i += step) {
    out.push({ x: xs[i], y: ys[i] })
  }
  return out
}

export function availableArrayKeys(
  arrays: Record<string, number[]> | undefined,
): string[] {
  if (!arrays) return []
  return Object.keys(arrays).filter((k) => (arrays[k]?.length ?? 0) > 0)
}
