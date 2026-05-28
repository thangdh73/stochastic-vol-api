import type { DistributionSpec } from '../types/api'
import { feetToMetres, metresToFeet } from '../constants/units'

export type NetPayDisplayUnit = 'feet' | 'metres'

function scaleDist(
  dist: DistributionSpec,
  factor: number,
  displayUnit: NetPayDisplayUnit,
): DistributionSpec {
  const scale = (v: number | null | undefined) => (v == null ? v : v * factor)
  return {
    ...dist,
    unit: displayUnit,
    canonical_unit: 'feet',
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

export function netPayDistToDisplay(
  canonicalFeet: DistributionSpec,
  unit: NetPayDisplayUnit,
): DistributionSpec {
  if (unit === 'metres') {
    return scaleDist(canonicalFeet, feetToMetres(1), unit)
  }
  return { ...canonicalFeet, unit: 'feet', canonical_unit: 'feet' }
}

export function netPayDistToCanonicalFeet(
  displayDist: DistributionSpec,
  unit: NetPayDisplayUnit,
): DistributionSpec {
  if (unit === 'metres') {
    return {
      ...scaleDist(displayDist, metresToFeet(1), unit),
      unit: 'feet',
      canonical_unit: 'feet',
    }
  }
  return { ...displayDist, unit: 'feet', canonical_unit: 'feet' }
}

