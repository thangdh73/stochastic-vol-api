import type {
  PetrelCumulativeCategorySummary,
  PetrelCumulativeRunResult,
  PercentileSummary,
} from '../types/api'

export interface PetrelChartSeries {
  key: string
  label: string
  values: number[]
  summary: PetrelCumulativeCategorySummary
}

const FIELD_ARRAY_KEYS: Record<'1P' | '2P' | '3P', string> = {
  '1P': 'total_giip_1p',
  '2P': 'total_giip_2p',
  '3P': 'total_giip_3p',
}

export function petrelSummaryToPercentileSummary(
  summary: PetrelCumulativeCategorySummary,
  productName: string,
): PercentileSummary {
  return {
    product_name: productName,
    unit: summary.unit,
    p99: summary.p90,
    p90: summary.p90,
    p50: summary.p50,
    mean_trimmed: summary.mean_trimmed,
    p10: summary.p10,
    p01: summary.p10,
  }
}

/** Build chartable GIIP series from Petrel cumulative MC arrays + roll-up summaries. */
export function buildPetrelChartSeries(result: PetrelCumulativeRunResult): PetrelChartSeries[] {
  const arrays = result.arrays
  if (!arrays) return []

  const series: PetrelChartSeries[] = []

  for (const cat of ['1P', '2P', '3P'] as const) {
    const key = FIELD_ARRAY_KEYS[cat]
    const values = arrays[key]
    if (values?.length) {
      series.push({
        key,
        label: `Field GIIP ${cat}`,
        values,
        summary: result.field[cat],
      })
    }
  }

  for (const seg of result.segments) {
    for (const cat of ['1P', '2P', '3P'] as const) {
      const key = `${seg.tank_key}::giip_${cat.toLowerCase()}`
      const values = arrays[key]
      if (values?.length) {
        series.push({
          key,
          label: `${seg.label} GIIP ${cat}`,
          values,
          summary: seg[cat],
        })
      }
    }
  }

  return series
}

export function defaultPetrelChartKey(series: PetrelChartSeries[]): string {
  const preferred = series.find((s) => s.key === 'total_giip_2p')
  return preferred?.key ?? series[0]?.key ?? ''
}
