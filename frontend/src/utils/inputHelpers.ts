import type { DistributionSpec, SimulationInput } from '../types/api'

export type DistKey = keyof Pick<
  SimulationInput,
  | 'area_dist'
  | 'percent_fill_dist'
  | 'net_pay_dist'
  | 'geometric_correction_dist'
  | 'porosity_dist'
  | 'saturation_dist'
  | 'oil_recovery_dist'
  | 'fvf_dist'
  | 'gor_dist'
  | 'solution_gas_recovery_dist'
  | 'gas_recovery_dist'
  | 'gef_dist'
  | 'condensate_yield_dist'
  | 'grv_dist'
  | 'grv_percent_fill_dist'
  | 'net_to_gross_dist'
  | 'nrv_direct_dist'
  | 'nrv_direct_multiplier_dist'
  | 'cross_check_area_dist'
>

export function updateInputField<K extends keyof SimulationInput>(
  input: SimulationInput,
  key: K,
  value: SimulationInput[K],
): SimulationInput {
  return { ...input, [key]: value }
}

export function updateDistribution(
  input: SimulationInput,
  key: DistKey,
  dist: DistributionSpec,
): SimulationInput {
  return { ...input, [key]: dist }
}

export function parseOptionalFloat(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Display fraction as percent in UI (0.178 → 17.8) */
export function fractionToPercentDisplay(v: number | null | undefined): string {
  if (v == null) return ''
  return String(v * 100)
}

/** Parse UI percent to canonical fraction (17.8 → 0.178) */
export function percentDisplayToFraction(raw: string): number | null {
  const n = parseOptionalFloat(raw)
  if (n == null) return null
  return n / 100
}
