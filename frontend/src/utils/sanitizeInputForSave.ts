import type { DistributionSpec, SimulationInput } from '../types/api'
import { prepareTankForApi } from './ensureSimulationReady'

const VALID_DIST_TYPES = new Set([
  'fixed',
  'uniform',
  'normal',
  'lognormal',
  'triangular',
  'beta',
  'pert',
])

function sanitizeDist(dist: DistributionSpec | null | undefined): DistributionSpec | null {
  if (!dist || typeof dist !== 'object') return dist ?? null
  const next = { ...dist }
  if (!VALID_DIST_TYPES.has(next.distribution_type)) {
    next.distribution_type = 'lognormal'
  }
  for (const key of ['p90', 'p50', 'p10', 'fixed_value', 'min_bound', 'max_bound'] as const) {
    const v = next[key]
    if (typeof v === 'number' && !Number.isFinite(v)) {
      next[key] = null
    }
  }
  return next
}

/** Strip invalid numbers / distribution types before persistence API calls. */
export function sanitizeInputForSave(input: SimulationInput): SimulationInput {
  const out = prepareTankForApi(input)
  for (const key of Object.keys(out) as (keyof SimulationInput)[]) {
    if (!key.endsWith('_dist')) continue
    const dist = out[key]
    if (dist && typeof dist === 'object') {
      ;(out as SimulationInput)[key] = sanitizeDist(dist as DistributionSpec) as never
    }
  }
  return out
}
