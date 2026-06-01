import type { GasResourceUnit, OilResourceUnit, RockVolumeInputUnit, SimulationInput } from '../types/api'

/** Unique select id — one per dropdown row (avoids duplicate HTML option values). */
export type GasUnitSelectId =
  | 'gas_bscm'
  | 'gas_bscm_mm3'
  | 'gas_mmscf_mcf'
  | 'gas_mmscf_mmcf'
  | 'gas_bcf'

export type OilUnitSelectId =
  | 'oil_mmscm'
  | 'oil_mmscm_mm3'
  | 'oil_mmstb_bbl'
  | 'oil_mmbo_mbbl'
  | 'oil_mmbo_mmbbl'

export type ResourceUnitSelectId = GasUnitSelectId | OilUnitSelectId

export interface GasUnitOption {
  id: GasUnitSelectId
  unit: GasResourceUnit
  /** Shown in Setup and on results (display label). */
  displayLabel: string
}

export interface OilUnitOption {
  id: OilUnitSelectId
  unit: OilResourceUnit
  displayLabel: string
}

export const GIIP_UNIT_SELECT_OPTIONS: GasUnitOption[] = [
  { id: 'gas_bscm', unit: 'Bscm', displayLabel: 'm³' },
  { id: 'gas_bscm_mm3', unit: 'Bscm', displayLabel: '10⁶ m³' },
  { id: 'gas_mmscf_mcf', unit: 'MMSCF', displayLabel: 'Mcf' },
  { id: 'gas_mmscf_mmcf', unit: 'MMSCF', displayLabel: 'MMcf' },
  { id: 'gas_bcf', unit: 'BCF', displayLabel: 'Bcf' },
]

export const STOIIP_UNIT_SELECT_OPTIONS: OilUnitOption[] = [
  { id: 'oil_mmscm', unit: 'MMscm', displayLabel: 'm³' },
  { id: 'oil_mmscm_mm3', unit: 'MMscm', displayLabel: '10⁶ m³' },
  { id: 'oil_mmstb_bbl', unit: 'MMSTB', displayLabel: 'bbl' },
  { id: 'oil_mmbo_mbbl', unit: 'MMBO', displayLabel: 'Mbbl' },
  { id: 'oil_mmbo_mmbbl', unit: 'MMBO', displayLabel: 'MMbbl' },
]

const GAS_BY_ID = Object.fromEntries(
  GIIP_UNIT_SELECT_OPTIONS.map((o) => [o.id, o]),
) as Record<GasUnitSelectId, GasUnitOption>

const OIL_BY_ID = Object.fromEntries(
  STOIIP_UNIT_SELECT_OPTIONS.map((o) => [o.id, o]),
) as Record<OilUnitSelectId, OilUnitOption>

export function gasOptionById(id: GasUnitSelectId): GasUnitOption {
  return GAS_BY_ID[id]
}

export function oilOptionById(id: OilUnitSelectId): OilUnitOption {
  return OIL_BY_ID[id]
}

export function defaultGasUnitSelectId(): GasUnitSelectId {
  return 'gas_bcf'
}

export function defaultOilUnitSelectId(): OilUnitSelectId {
  return 'oil_mmbo_mmbbl'
}

/** Resolve persisted id, or infer from engine unit (legacy projects). */
export function resolveGasUnitSelectId(
  stored: string | undefined,
  unit: GasResourceUnit | undefined,
): GasUnitSelectId {
  if (stored && stored in GAS_BY_ID) return stored as GasUnitSelectId
  switch (unit) {
    case 'Bscm':
      return 'gas_bscm'
    case 'MMSCF':
      return 'gas_mmscf_mmcf'
    case 'BCF':
    default:
      return 'gas_bcf'
  }
}

export function resolveOilUnitSelectId(
  stored: string | undefined,
  unit: OilResourceUnit | undefined,
): OilUnitSelectId {
  if (stored && stored in OIL_BY_ID) return stored as OilUnitSelectId
  switch (unit) {
    case 'MMscm':
      return 'oil_mmscm_mm3'
    case 'MMSTB':
      return 'oil_mmstb_bbl'
    case 'MMBO':
    default:
      return 'oil_mmbo_mmbbl'
  }
}

export function gasDisplayLabelForUnit(unit: GasResourceUnit, selectId?: string): string {
  const id = resolveGasUnitSelectId(selectId, unit)
  return gasOptionById(id).displayLabel
}

export function oilDisplayLabelForUnit(unit: OilResourceUnit, selectId?: string): string {
  const id = resolveOilUnitSelectId(selectId, unit)
  return oilOptionById(id).displayLabel
}

export function applyGasUnitSelectToInput(
  input: SimulationInput,
  selectId: GasUnitSelectId,
): SimulationInput {
  const opt = gasOptionById(selectId)
  return { ...input, gas_resource_unit: opt.unit }
}

export function applyOilUnitSelectToInput(
  input: SimulationInput,
  selectId: OilUnitSelectId,
): SimulationInput {
  const opt = oilOptionById(selectId)
  return { ...input, oil_resource_unit: opt.unit }
}

/** Every GIIP/STOIIP dropdown row must have a distinct id (regression: MMcf vs Mcf). */
export function assertUniqueGasUnitSelectIds(): void {
  const ids = GIIP_UNIT_SELECT_OPTIONS.map((o) => o.id)
  if (new Set(ids).size !== ids.length) {
    throw new Error('Duplicate gas unit select ids')
  }
}

export function assertUniqueOilUnitSelectIds(): void {
  const ids = STOIIP_UNIT_SELECT_OPTIONS.map((o) => o.id)
  if (new Set(ids).size !== ids.length) {
    throw new Error('Duplicate oil unit select ids')
  }
}

export const GRV_UNIT_SELECT_OPTIONS: Array<{ value: RockVolumeInputUnit; label: string }> = [
  { value: 'm3', label: 'm³' },
  { value: 'million_m3', label: '10⁶ m³' },
  { value: 'ft3', label: 'ft³' },
  { value: 'thousand_ft3', label: '10³ ft³' },
  { value: 'million_ft3', label: '10⁶ ft³' },
  { value: 'acre_ft', label: 'acre-ft' },
]

export function assertUniqueGrvUnitValues(): void {
  const values = GRV_UNIT_SELECT_OPTIONS.map((o) => o.value)
  if (new Set(values).size !== values.length) {
    throw new Error('Duplicate GRV unit option values')
  }
}
