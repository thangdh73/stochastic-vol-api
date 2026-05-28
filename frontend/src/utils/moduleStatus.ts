import type { SimulationInput, ValidationReport } from '../types/api'
import {
  applyOilRecovery,
  includeChance,
  includeSolutionGas,
  usesCcopRisk,
} from './calculationToggles'
import { effectiveEstimatingMethod } from './estimatingMethod'

export type ModuleKey =
  | 'prospect'
  | 'area'
  | 'net_pay'
  | 'nrv'
  | 'hc_yield'
  | 'chance'
  | 'correlations'
  | 'simulation'
  | 'results'

export type ModuleStatus = 'complete' | 'incomplete' | 'blocked' | 'skipped' | 'unknown'

function distReady(d: SimulationInput[keyof SimulationInput] extends infer T ? T : never): boolean {
  const dist = d as any
  if (!dist) return false
  const t = String(dist.distribution_type ?? '').toLowerCase()
  if (t === 'fixed') return dist.fixed_value != null && Number.isFinite(dist.fixed_value)
  return dist.p90 != null && dist.p10 != null && Number.isFinite(dist.p90) && Number.isFinite(dist.p10)
}

function hasChanceAllFive(input: SimulationInput): boolean {
  const cats = input.chance_categories ?? {}
  const required = ['source', 'timing_migration', 'reservoir', 'closure', 'containment']
  return required.every((k) => Array.isArray(cats[k]) && cats[k].length > 0)
}

export function computeModuleStatuses(
  input: SimulationInput | null | undefined,
  validation: ValidationReport | null | undefined,
  hasSimulationResult: boolean,
): Record<ModuleKey, ModuleStatus> {
  const out: Record<ModuleKey, ModuleStatus> = {
    prospect: 'unknown',
    area: 'unknown',
    net_pay: 'unknown',
    nrv: 'unknown',
    hc_yield: 'unknown',
    chance: 'unknown',
    correlations: 'unknown',
    simulation: 'unknown',
    results: 'unknown',
  }

  if (!input) {
    Object.keys(out).forEach((k) => {
      out[k as ModuleKey] = 'incomplete'
    })
    return out
  }

  out.prospect = input.prospect_name?.trim() ? 'complete' : 'incomplete'

  const method = effectiveEstimatingMethod(input)
  if (method === 'nrv_grv_yield') {
    out.nrv =
      (input.nrv_entry_mode === 'direct' ? distReady(input.nrv_direct_dist) : true) &&
      (input.nrv_entry_mode === 'direct'
        ? true
        : distReady(input.grv_dist) && distReady(input.grv_percent_fill_dist) && distReady(input.net_to_gross_dist))
        ? 'complete'
        : 'incomplete'
    out.area = 'unknown'
    out.net_pay = 'unknown'
  } else {
    out.area = distReady(input.area_dist) && distReady(input.percent_fill_dist) ? 'complete' : 'incomplete'
    out.net_pay = distReady(input.net_pay_dist) ? 'complete' : 'incomplete'
    out.nrv = 'unknown'
  }

  const ft = (input.fluid_type ?? 'oil').toLowerCase()
  const hcBase = distReady(input.porosity_dist) && distReady(input.saturation_dist)
  let hcFluid = false
  if (ft === 'oil') {
    const recoveryOk = !applyOilRecovery(input) || distReady(input.oil_recovery_dist)
    const sgOk =
      !includeSolutionGas(input) ||
      (distReady(input.gor_dist) && distReady(input.solution_gas_recovery_dist))
    hcFluid = distReady(input.fvf_dist) && recoveryOk && sgOk
  } else if (ft === 'gas' || ft === 'gas_condensate') {
    hcFluid = distReady(input.gas_recovery_dist) && distReady(input.gef_dist)
  }
  out.hc_yield = hcBase && hcFluid ? 'complete' : 'incomplete'

  if (!includeChance(input)) {
    out.chance = 'skipped'
  } else if (usesCcopRisk(input)) {
    out.chance = input.ccop_risk ? 'complete' : 'incomplete'
  } else {
    out.chance = hasChanceAllFive(input) ? 'complete' : 'incomplete'
  }

  const mode = input.correlation_mode ?? 'independent'
  out.correlations = mode === 'independent' || (input.correlations?.length ?? 0) > 0 ? 'complete' : 'incomplete'

  out.simulation = validation?.has_errors ? 'blocked' : 'incomplete'
  if (validation && !validation.has_errors) out.simulation = 'complete'

  out.results = hasSimulationResult ? 'complete' : 'incomplete'
  return out
}

export function moduleStatusLabel(status: ModuleStatus): string {
  switch (status) {
    case 'complete':
      return 'Complete'
    case 'skipped':
      return 'Not evaluated'
    case 'blocked':
      return 'Blocked'
    case 'incomplete':
      return 'Incomplete'
    default:
      return '—'
  }
}
