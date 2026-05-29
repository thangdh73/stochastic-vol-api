import type { SimulationInput } from '../types/api'
import type { DistKey } from './inputHelpers'
import { showProbabilisticNtgInput, type PetroParamKey } from './setupInputParams'

export type HcYieldControlColumn = {
  key: DistKey
  label: string
  asPercent?: boolean
}

export function tankShowsNtgColumn(
  petroConstants: Record<PetroParamKey, boolean>,
  tank: SimulationInput | null | undefined,
): boolean {
  return showProbabilisticNtgInput(petroConstants, tank)
}

export function hcYieldTableColumns(
  sampleInput: SimulationInput | null,
  anyTankNtg: boolean,
): HcYieldControlColumn[] {
  const isGas =
    sampleInput?.fluid_type === 'gas' || sampleInput?.fluid_type === 'gas_condensate'

  const cols: HcYieldControlColumn[] = [
    { key: 'porosity_dist', label: 'Poro' },
    { key: 'saturation_dist', label: 'Sw' },
  ]

  if (isGas) {
    cols.push({ key: 'gef_dist', label: 'GEF' })
  } else {
    cols.push({ key: 'fvf_dist', label: 'FVF' })
  }

  if (anyTankNtg) {
    cols.push({ key: 'net_to_gross_dist', label: 'NTG' })
  }

  return cols
}

export const HC_YIELD_DIST_KEYS: DistKey[] = [
  'porosity_dist',
  'saturation_dist',
  'oil_recovery_dist',
  'fvf_dist',
  'gor_dist',
  'solution_gas_recovery_dist',
  'gas_recovery_dist',
  'gef_dist',
  'condensate_yield_dist',
]

export function isHcYieldDistKey(key: DistKey): boolean {
  return HC_YIELD_DIST_KEYS.includes(key)
}
