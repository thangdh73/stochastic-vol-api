import type { DistributionSpec } from '../types/api'
import type { RockVolumeInputUnit } from '../constants/inputUnits'
import { ACFT_TO_FT3, ACFT_TO_M3 } from '../constants/units'

const THOUSAND = 1000
const MILLION = 1_000_000

/** Multiply canonical acre-ft by this to get display-unit values. */
export function acreFtToDisplayFactor(unit: RockVolumeInputUnit): number {
  switch (unit) {
    case 'thousand_acre_ft':
      return 1 / THOUSAND
    case 'ft3':
      return ACFT_TO_FT3
    case 'm3':
      return ACFT_TO_M3
    case 'thousand_ft3':
      return ACFT_TO_FT3 / THOUSAND
    case 'thousand_m3':
      return ACFT_TO_M3 / THOUSAND
    case 'million_ft3':
      return ACFT_TO_FT3 / MILLION
    case 'million_m3':
      return ACFT_TO_M3 / MILLION
    default:
      return 1
  }
}

export function rockVolumeUnitLabel(unit: RockVolumeInputUnit): string {
  switch (unit) {
    case 'thousand_acre_ft':
      return 'thousand acre-ft'
    case 'ft3':
      return 'ft³'
    case 'm3':
      return 'm³'
    case 'thousand_ft3':
      return 'thousand ft³'
    case 'thousand_m3':
      return 'thousand m³'
    case 'million_ft3':
      return 'million ft³ (×10⁶)'
    case 'million_m3':
      return 'million m³ (×10⁶)'
    default:
      return 'acre-ft'
  }
}

function scaleDist(
  dist: DistributionSpec,
  factor: number,
  displayUnit: RockVolumeInputUnit,
): DistributionSpec {
  const scale = (v: number | null | undefined) => (v == null ? v : v * factor)
  return {
    ...dist,
    unit: rockVolumeUnitLabel(displayUnit),
    canonical_unit: 'acre-ft',
    fixed_value: scale(dist.fixed_value),
    p90: scale(dist.p90),
    p50: scale(dist.p50),
    p10: scale(dist.p10),
    tri_min: scale(dist.tri_min),
    tri_mode: scale(dist.tri_mode),
    tri_max: scale(dist.tri_max),
    low_clip: scale(dist.low_clip),
    high_clip: scale(dist.high_clip),
    min_bound: scale(dist.min_bound),
    max_bound: scale(dist.max_bound),
  }
}

/** Show rock-volume distribution in the selected input unit (engine stores acre-ft). */
export function rockVolumeDistToDisplay(
  canonicalAcreFt: DistributionSpec,
  unit: RockVolumeInputUnit,
): DistributionSpec {
  const factor = acreFtToDisplayFactor(unit)
  if (factor === 1) {
    return { ...canonicalAcreFt, unit: 'acre-ft', canonical_unit: 'acre-ft' }
  }
  return scaleDist(canonicalAcreFt, factor, unit)
}

/** Persist rock-volume distribution from display unit back to acre-ft. */
export function rockVolumeDistToCanonical(
  displayDist: DistributionSpec,
  unit: RockVolumeInputUnit,
): DistributionSpec {
  const factor = acreFtToDisplayFactor(unit)
  if (factor === 1) {
    return { ...displayDist, unit: 'acre-ft', canonical_unit: 'acre-ft' }
  }
  return {
    ...scaleDist(displayDist, 1 / factor, unit),
    unit: 'acre-ft',
    canonical_unit: 'acre-ft',
  }
}

export function rockVolumeScalarToDisplay(
  canonicalAcreFt: number,
  unit: RockVolumeInputUnit,
): number {
  return canonicalAcreFt * acreFtToDisplayFactor(unit)
}

export function rockVolumeScalarToCanonical(
  display: number,
  unit: RockVolumeInputUnit,
): number {
  const factor = acreFtToDisplayFactor(unit)
  return factor === 1 ? display : display / factor
}
