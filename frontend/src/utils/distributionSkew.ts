import type { DistributionSpec } from '../types/api'

/** Distribution types that support skew (3-point P90 / P50 / P10 fit). */
export const SKEW_DISTRIBUTION_TYPES = new Set(['lognormal', 'normal', 'beta'])

/** Original MMRA default: lognormal and beta use P50 in the fit (3-point / skew). */
export function defaultSkewEnabled(distributionType: string): boolean {
  return distributionType === 'lognormal' || distributionType === 'beta'
}

export function distributionSupportsSkew(distributionType: string): boolean {
  return SKEW_DISTRIBUTION_TYPES.has(distributionType)
}

/** Dropdown label — matches original MMRA naming for 3-point types. */
export function distributionTypeOptionLabel(distributionType: string): string {
  switch (distributionType) {
    case 'fixed':
      return 'Fixed (single value)'
    case 'uniform':
      return 'Uniform (min–max)'
    case 'normal':
      return 'Normal'
    case 'lognormal':
      return 'Lognormal (P90 / P50 / P10)'
    case 'beta':
      return 'Beta (P90 / P50 / P10)'
    case 'triangular':
      return 'Triangular'
    case 'pert':
      return 'PERT (P90 / P50 / P10)'
    default:
      return distributionType
  }
}

export function skewHelpText(distributionType: string, skewOn: boolean): string {
  switch (distributionType) {
    case 'lognormal':
      return skewOn
        ? 'Skew on: fits P90, P50, and P10 together (asymmetric lognormal — original MMRA behaviour).'
        : 'Skew off: only P90 and P10 define the distribution (symmetric lognormal).'
    case 'beta':
      return skewOn
        ? 'Skew on: fits P90, P50, and P10 within min/max bounds (original MMRA behaviour).'
        : 'Skew off: only P90 and P10 are used to fit beta shape.'
    case 'normal':
      return skewOn
        ? 'Skew on: mean is set at P50 (distribution remains symmetric).'
        : 'Skew off: mean is the midpoint of P90 and P10.'
    default:
      return ''
  }
}

/** Apply type change with original MMRA defaults (lognormal / beta → skew on). */
export function patchForDistributionTypeChange(
  dist: DistributionSpec,
  nextType: string,
): Partial<DistributionSpec> {
  const next: Partial<DistributionSpec> = {
    distribution_type: nextType,
    fixed_value: nextType === 'fixed' ? dist.fixed_value ?? dist.p50 ?? 0 : dist.fixed_value,
  }
  if (distributionSupportsSkew(nextType)) {
    next.skew_enabled = defaultSkewEnabled(nextType)
  } else {
    next.skew_enabled = false
  }
  return next
}

/** Auto-enable skew when P50 is entered on lognormal / beta (original MMRA workflow). */
export function patchPercentileWithSkew(
  dist: DistributionSpec,
  field: 'p90' | 'p50' | 'p10',
  value: number | null,
): Partial<DistributionSpec> {
  const next: Partial<DistributionSpec> = { [field]: value }
  if (
    field === 'p50' &&
    value != null &&
    Number.isFinite(value) &&
    defaultSkewEnabled(dist.distribution_type)
  ) {
    next.skew_enabled = true
  }
  return next
}
