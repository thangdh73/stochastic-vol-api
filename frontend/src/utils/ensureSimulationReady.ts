import type { DistributionSpec, SimulationInput } from '../types/api'
import { ensureGasCondensateFields, ensureNrvDistributions, emptyDistribution } from './defaultInput'
import { prepareInputForApi } from './prepareInputForApi'

function distNeedsPercentiles(dist: DistributionSpec | null | undefined): boolean {
  if (!dist) return false
  if (dist.distribution_type === 'fixed') {
    return dist.fixed_value == null || !Number.isFinite(dist.fixed_value)
  }
  return dist.p90 == null || dist.p10 == null
}

function withPercentiles(
  dist: DistributionSpec,
  p90: number,
  p50: number,
  p10: number,
): DistributionSpec {
  return {
    ...dist,
    p90,
    p50,
    p10,
    min_bound: dist.min_bound ?? (dist.unit === 'fraction' || dist.canonical_unit === 'fraction' ? 0 : dist.min_bound),
    max_bound: dist.max_bound ?? (dist.unit === 'fraction' || dist.canonical_unit === 'fraction' ? 1 : dist.max_bound),
  }
}

/** Repair invalid PERT triplets (zeros, reversed) before API validation. */
export function repairPertDistribution(
  dist: DistributionSpec,
  defaults: { p90: number; p50: number; p10: number },
): DistributionSpec {
  if (dist.distribution_type !== 'pert') return dist
  let { p90, p50, p10 } = dist
  const isFraction =
    dist.unit === 'fraction' ||
    dist.canonical_unit === 'fraction' ||
    dist.variable_id === 'pet_eval'
  if (
    p90 == null ||
    p50 == null ||
    p10 == null ||
    !Number.isFinite(p90) ||
    !Number.isFinite(p50) ||
    !Number.isFinite(p10) ||
    (p90 === 0 && p50 === 0 && p10 === 0) ||
    p90 >= p10
  ) {
    p90 = defaults.p90
    p50 = defaults.p50
    p10 = defaults.p10
  }
  if (isFraction) {
    p90 = Math.max(0, Math.min(1, p90))
    p50 = Math.max(0, Math.min(1, p50))
    p10 = Math.max(0, Math.min(1, p10))
    if (p90 >= p10) {
      p90 = defaults.p90
      p50 = defaults.p50
      p10 = defaults.p10
    }
    if (!(p90 <= p50 && p50 <= p10)) {
      p50 = Math.max(p90, Math.min(p10, p50))
    }
  }
  return { ...dist, p90, p50, p10, fixed_value: null }
}

function repairAllDists(input: SimulationInput): SimulationInput {
  let out = { ...input }
  for (const key of Object.keys(out) as (keyof SimulationInput)[]) {
    if (!key.endsWith('_dist')) continue
    const dist = out[key] as DistributionSpec | null | undefined
    if (!dist || typeof dist !== 'object') continue
    if (dist.distribution_type === 'pert') {
      const defaults =
        key === 'pet_evaluation_dist'
          ? { p90: 0.7, p50: 0.85, p10: 1.0 }
          : dist.unit === 'fraction' || dist.canonical_unit === 'fraction'
            ? { p90: 0.55, p50: 0.75, p10: 0.92 }
            : { p90: 0.9, p50: 1.0, p10: 1.1 }
      ;(out as SimulationInput)[key] = repairPertDistribution(dist, defaults) as never
    }
  }
  return out
}

/** Fill missing P90/P10 on HC yield and recovery distributions so validation can pass. */
export function ensureHcYieldDistributions(input: SimulationInput): SimulationInput {
  const isOil = input.fluid_type === 'oil'
  const isGas = input.fluid_type === 'gas' || input.fluid_type === 'gas_condensate'

  let out: SimulationInput = { ...input }

  if (distNeedsPercentiles(out.porosity_dist) && out.porosity_dist) {
    out.porosity_dist = withPercentiles(out.porosity_dist, 0.12, 0.18, 0.24)
  }
  if (distNeedsPercentiles(out.saturation_dist) && out.saturation_dist) {
    out.saturation_dist = withPercentiles(out.saturation_dist, 0.55, 0.7, 0.85)
  }

  if (isOil) {
    if (distNeedsPercentiles(out.oil_recovery_dist) && out.oil_recovery_dist) {
      out.oil_recovery_dist = withPercentiles(out.oil_recovery_dist, 0.25, 0.35, 0.45)
    }
    if (out.fvf_dist?.distribution_type === 'fixed' && out.fvf_dist.fixed_value == null) {
      out.fvf_dist = { ...out.fvf_dist, fixed_value: 1.2 }
    }
    if (distNeedsPercentiles(out.gor_dist) && out.gor_dist) {
      out.gor_dist = withPercentiles(out.gor_dist, 400, 800, 1200)
    }
  }

  if (isGas) {
    if (distNeedsPercentiles(out.gas_recovery_dist) && out.gas_recovery_dist) {
      out.gas_recovery_dist = withPercentiles(out.gas_recovery_dist, 0.6, 0.75, 0.9)
    }
    if (out.gef_dist?.distribution_type === 'fixed' && out.gef_dist.fixed_value == null) {
      out.gef_dist = { ...out.gef_dist, fixed_value: 0.0035 }
    }
    if (input.fluid_type === 'gas_condensate') {
      out = ensureGasCondensateFields(out)
    }
  }

  return out
}

export function ensureSimulationReadyInput(input: SimulationInput): SimulationInput {
  let out = ensureNrvDistributions(input)
  out = ensureHcYieldDistributions(out)
  out = repairAllDists(out)
  if (out.pet_evaluation_dist == null) return out
  out = {
    ...out,
    pet_evaluation_dist: repairPertDistribution(out.pet_evaluation_dist, {
      p90: 0.7,
      p50: 0.85,
      p10: 1.0,
    }),
  }
  return out
}

/** Normalize one tank before validate / simulate / save API calls. */
export function prepareTankForApi(input: SimulationInput): SimulationInput {
  return prepareInputForApi(ensureSimulationReadyInput(input))
}

export function defaultPertForPetroKey(key: 'ntg' | 'poro' | 'sw' | 'bo'): {
  p90: number
  p50: number
  p10: number
} {
  switch (key) {
    case 'ntg':
      return { p90: 0.55, p50: 0.75, p10: 0.92 }
    case 'poro':
      return { p90: 0.12, p50: 0.18, p10: 0.24 }
    case 'sw':
      return { p90: 0.55, p50: 0.7, p10: 0.85 }
    case 'bo':
      return { p90: 1.0, p50: 1.2, p10: 1.4 }
    default:
      return { p90: 0.55, p50: 0.75, p10: 0.92 }
  }
}

export function emptyPertDistribution(
  variableId: string,
  displayName: string,
  unit: string,
  defaults: { p90: number; p50: number; p10: number },
): DistributionSpec {
  return {
    ...emptyDistribution(variableId, displayName, unit, 'pert'),
    ...defaults,
  }
}
