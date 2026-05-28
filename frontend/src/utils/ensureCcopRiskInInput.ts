import { defaultCcopRisk } from '../constants/ccopChance'
import type { SimulationInput } from '../types/api'
import { isCcopRiskModel } from './calculationToggles'

/** Persist CCOP defaults into workflow state when the model is CCOP but data was never saved. */
export function ensureCcopRiskInInput(input: SimulationInput): SimulationInput {
  if (!isCcopRiskModel(input) || input.ccop_risk) {
    return input
  }
  return {
    ...input,
    risk_model: 'ccop_v1',
    include_chance: input.include_chance !== false,
    chance_categories: {},
    ccop_risk: defaultCcopRisk(),
  }
}
