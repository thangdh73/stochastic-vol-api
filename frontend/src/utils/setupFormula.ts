import type { SimulationInput } from '../types/api'
import { ensureNrvDistributions } from './defaultInput'
import { ensureHcYieldDistributions } from './ensureSimulationReady'

export type SetupFormulaId = 'stoiip_sw' | 'giip_sw' | 'stoiip_so' | 'giip_sg'

export type SetupFormulaFamily = 'oil' | 'gas'

export const SETUP_FORMULA_OPTIONS: Array<{
  id: SetupFormulaId
  label: string
  family: SetupFormulaFamily
}> = [
  { id: 'stoiip_sw', label: 'STOIIP = GRV.NTG.PORO.(1-Sw)/Bo', family: 'oil' },
  { id: 'giip_sw', label: 'GIIP = GRV.NTG.PORO.(1-Sw)/Bg', family: 'gas' },
  { id: 'stoiip_so', label: 'STOIIP = GRV.NTG.PORO.So/Bo', family: 'oil' },
  { id: 'giip_sg', label: 'GIIP = GRV.NTG.PORO.Sg/Bg', family: 'gas' },
]

const VALID_FORMULA_IDS = new Set<string>(SETUP_FORMULA_OPTIONS.map((o) => o.id))

export function isSetupFormulaId(value: string | undefined | null): value is SetupFormulaId {
  return value != null && VALID_FORMULA_IDS.has(value)
}

export function setupFormulaFamily(id: SetupFormulaId): SetupFormulaFamily {
  return SETUP_FORMULA_OPTIONS.find((o) => o.id === id)?.family ?? 'oil'
}

/** Infer formula from persisted fluid_type when envelope has no formula_id. */
export function inferSetupFormulaId(input: SimulationInput | null | undefined): SetupFormulaId {
  if (!input) return 'stoiip_sw'
  const ft = (input.fluid_type ?? 'oil').toLowerCase()
  if (ft === 'gas' || ft === 'gas_condensate') return 'giip_sw'
  return 'stoiip_sw'
}

export function resolveSetupFormulaId(
  stored: string | undefined,
  input: SimulationInput | null | undefined,
): SetupFormulaId {
  if (isSetupFormulaId(stored)) return stored
  return inferSetupFormulaId(input)
}

/** Apply formula choice to simulation input (fluid type + gas/oil dist readiness). */
export function applySetupFormulaToInput(
  input: SimulationInput,
  formulaId: SetupFormulaId,
): SimulationInput {
  const family = setupFormulaFamily(formulaId)
  if (family === 'gas') {
    let next: SimulationInput = {
      ...ensureNrvDistributions(input),
      fluid_type: 'gas',
      estimating_method: 'nrv_grv_yield',
    }
    return ensureHcYieldDistributions(next)
  }
  const next: SimulationInput = {
    ...ensureNrvDistributions(input),
    fluid_type: 'oil',
    estimating_method: 'nrv_grv_yield',
  }
  return ensureHcYieldDistributions(next)
}
