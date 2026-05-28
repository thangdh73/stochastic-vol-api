import type { DistributionSpec } from '../types/api'
import { acresToSqKm, sqKmToAcres } from '../constants/units'

function scaleDist(dist: DistributionSpec, factor: number): DistributionSpec {
  const scale = (v: number | null | undefined) =>
    v == null ? v : v * factor
  return {
    ...dist,
    unit: 'sq km',
    canonical_unit: 'acres',
    fixed_value: scale(dist.fixed_value),
    p90: scale(dist.p90),
    p50: scale(dist.p50),
    p10: scale(dist.p10),
    tri_min: scale(dist.tri_min),
    tri_mode: scale(dist.tri_mode),
    tri_max: scale(dist.tri_max),
    low_clip: scale(dist.low_clip),
    high_clip: scale(dist.high_clip),
  }
}

/** Show area distribution in sq km (engine still stores acres). */
export function areaDistToSqKm(dist: DistributionSpec): DistributionSpec {
  return scaleDist(dist, acresToSqKm(1))
}

/** Persist area distribution from sq km form back to acres. */
export function areaDistToAcres(dist: DistributionSpec): DistributionSpec {
  return {
    ...scaleDist(dist, sqKmToAcres(1)),
    unit: 'acres',
    canonical_unit: 'acres',
  }
}
