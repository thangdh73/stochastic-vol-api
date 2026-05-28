import type { RockVolumeInputUnit } from '../constants/inputUnits'
import { rockVolumeInputUnitLabel } from '../constants/inputUnits'
import type { PercentileSummary } from '../types/api'
import { acreFtToDisplayFactor } from './rockVolumeUnits'

const ROCK_VOLUME_SUMMARY_KEYS = new Set([
  'nrv_acft',
  'grv_acft',
  'hcpv_acft',
])

/** Convert engine summaries (canonical acre-ft) to the prospect display unit. */
export function summaryForDisplay(
  key: string,
  summary: PercentileSummary,
  rockVolumeUnit?: RockVolumeInputUnit,
): PercentileSummary {
  if (!rockVolumeUnit || !ROCK_VOLUME_SUMMARY_KEYS.has(key)) {
    return summary
  }
  const factor = acreFtToDisplayFactor(rockVolumeUnit)
  if (factor === 1) {
    return { ...summary, unit: rockVolumeInputUnitLabel(rockVolumeUnit) }
  }
  const scale = (v: number) => v * factor
  return {
    ...summary,
    unit: rockVolumeInputUnitLabel(rockVolumeUnit),
    p90: scale(summary.p90),
    p50: scale(summary.p50),
    p10: scale(summary.p10),
    mean_trimmed: summary.mean_trimmed != null ? scale(summary.mean_trimmed) : summary.mean_trimmed,
  }
}

export function scaleRockVolumeArray(
  values: number[],
  unit?: RockVolumeInputUnit,
): number[] {
  if (!unit) return values
  const factor = acreFtToDisplayFactor(unit)
  if (factor === 1) return values
  return values.map((v) => v * factor)
}
