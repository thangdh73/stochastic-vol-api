import { defaultCcopRisk } from '../constants/ccopChance'
import type { SimulationInput } from '../types/api'
import {
  applyOilRecovery,
  includeChance,
  includeSolutionGas,
  isCcopRiskModel,
  isOilCase,
  usesCcopRisk,
} from './calculationToggles'
import { ensureGasCondensateFields } from './defaultInput'

/**
 * Ensure calculation toggles are explicit booleans on every API request.
 * JSON.stringify omits `undefined` fields; the backend must receive false, not silence.
 */
export function prepareInputForApi(input: SimulationInput): SimulationInput {
  const out: SimulationInput = { ...input }
  if (isOilCase(out)) {
    out.apply_oil_recovery = applyOilRecovery(out)
    out.include_solution_gas = includeSolutionGas(out)
    if (!out.apply_oil_recovery) {
      out.oil_recovery_dist = null
    }
    if (!out.include_solution_gas) {
      out.gor_dist = null
      out.solution_gas_recovery_dist = null
    }
  }
  if (!out.include_chance && out.include_chance !== false && isCcopRiskModel(out)) {
    out.include_chance = true
  }
  out.include_chance = includeChance(out)
  if (!out.include_chance) {
    out.chance_categories = {}
    out.ccop_risk = null
  } else if (isCcopRiskModel(out)) {
    out.risk_model = 'ccop_v1'
    out.chance_categories = {}
    out.ccop_risk = out.ccop_risk ?? defaultCcopRisk()
    out.include_chance = true
  } else if (usesCcopRisk(out)) {
    out.chance_categories = {}
    out.risk_model = 'ccop_v1'
  } else {
    out.ccop_risk = null
    out.risk_model = 'legacy'
  }
  if (out.fluid_type === 'gas_condensate') {
    return ensureGasCondensateFields(out)
  }
  out.condensate_yield_dist = null
  return out
}
