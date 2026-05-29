import type { DistributionSpec, SimulationInput } from '../types/api'
import { emptyDistribution, ensureNrvDistributions } from './defaultInput'
import { defaultPertForPetroKey } from './ensureSimulationReady'
import { effectiveEstimatingMethod } from './estimatingMethod'

export const DISTRIBUTION_TYPE_LABELS: Record<string, string> = {
  fixed: 'Fixed (single value)',
  uniform: 'Uniform (min–max)',
  normal: 'Normal',
  lognormal: 'Lognormal (P90 / P50 / P10)',
  triangular: 'Triangular',
  beta: 'Beta (P90 / P50 / P10)',
  pert: 'PERT (P90 / P50 / P10)',
}

export function distributionTypeLabel(dist: DistributionSpec | null | undefined): string {
  if (!dist?.distribution_type) return '—'
  return DISTRIBUTION_TYPE_LABELS[dist.distribution_type] ?? dist.distribution_type
}

export type GrvParamSlot = 'depth' | 'pinchout' | 'owc'
export type PetroParamKey = 'ntg' | 'poro' | 'sw' | 'bo'
export type SetupPetroListKey = PetroParamKey | 'pet_eval'
export type InputSubTab = 'grv' | 'petro'

export const PETRO_PARAM_KEYS: PetroParamKey[] = ['ntg', 'poro', 'sw', 'bo']
export const DEFAULT_PET_EVAL_LABEL = 'PET Evaluation'

export const DEFAULT_GRV_PARAM_LABELS = ['Depth', 'Pinchout', 'Fluid contact'] as const

/** First three Setup GRV rows map to engine slots (NRV method: depth→GRV, pinchout→fill; owc is label-only — use Pinchout row for fill MC/tornado). */
export const GRV_SLOT_BY_INDEX: (GrvParamSlot | null)[] = ['depth', 'pinchout', 'owc']

export const DEFAULT_PETRO_PARAM_LABELS: Record<PetroParamKey, string> = {
  ntg: 'NTG',
  poro: 'PORO',
  sw: 'Sw',
  bo: 'Bo',
}

export function grvSlotForIndex(index: number): GrvParamSlot | null {
  return GRV_SLOT_BY_INDEX[index] ?? null
}

export function grvDistributionForIndex(
  input: SimulationInput,
  index: number,
): DistributionSpec | null | undefined {
  const slot = grvSlotForIndex(index)
  if (!slot) return null
  return grvDistributionForSlot(input, slot)
}

export function grvDistributionForSlot(
  input: SimulationInput,
  slot: GrvParamSlot,
): DistributionSpec | null | undefined {
  const method = effectiveEstimatingMethod(input)
  switch (slot) {
    case 'depth':
      return input.grv_dist ?? input.area_dist
    case 'pinchout':
      return input.grv_percent_fill_dist ?? input.percent_fill_dist
    case 'owc':
      // NRV×GRV route: fluid-contact row is organizational; fill drives grv_percent_fill (see Setup help).
      if (method === 'nrv_grv_yield') {
        return input.grv_percent_fill_dist ?? input.percent_fill_dist
      }
      return input.net_pay_dist
    default:
      return null
  }
}

export function petroDistributionForKey(
  input: SimulationInput,
  key: PetroParamKey,
): DistributionSpec | null | undefined {
  switch (key) {
    case 'ntg':
      return input.net_to_gross_dist
    case 'poro':
      return input.porosity_dist
    case 'sw':
      return input.saturation_dist
    case 'bo':
      return input.fvf_dist ?? input.gef_dist
    default:
      return null
  }
}

export function setupPetroListKeys(
  petroConstants: Record<PetroParamKey, boolean>,
  petEvaluationEnabled: boolean,
): SetupPetroListKey[] {
  const keys = PETRO_PARAM_KEYS.filter((key) => !petroConstants[key])
  return petEvaluationEnabled ? [...keys, 'pet_eval'] : keys
}

export function setupPetroDistributionForKey(
  input: SimulationInput,
  key: SetupPetroListKey,
): DistributionSpec | null | undefined {
  if (key === 'pet_eval') return input.pet_evaluation_dist
  return petroDistributionForKey(input, key)
}

export function setupPetroLabelForKey(
  key: SetupPetroListKey,
  petroParamLabels: Record<PetroParamKey, string>,
  petEvalLabel: string,
): string {
  if (key === 'pet_eval') return petEvalLabel
  return petroParamLabels[key]
}

export function editorPathForSetupPetroKey(
  key: SetupPetroListKey,
  input?: SimulationInput | null,
): string {
  if (key === 'pet_eval') return '/input/hc-yield'
  return editorPathForPetroKey(key, input)
}

export const NRV_DIRECT_FOCUS = 'nrv_direct'

export function isNrvDirectFromNtgConstant(
  petroConstants: Record<PetroParamKey, boolean>,
  input?: SimulationInput | null,
): boolean {
  if (!petroConstants.ntg) return false
  if (input?.nrv_entry_mode === 'direct') return true
  return petroConstants.ntg
}

/** NTG spreadsheet on Input → HC yield (hidden for Direct NRV or constant NTG on Setup). */
export function showProbabilisticNtgInput(
  petroConstants: Record<PetroParamKey, boolean>,
  input?: SimulationInput | null,
): boolean {
  if (petroConstants.ntg) return false
  if (!input) return false
  if (effectiveEstimatingMethod(input) !== 'nrv_grv_yield') return false
  if (input.nrv_entry_mode === 'direct') return false
  return true
}

export type RockVolumeColumn =
  | { kind: 'grv_slot'; index: number; slot: GrvParamSlot; label: string }
  | { kind: 'nrv_direct'; label: string }

export function rockVolumeColumns(
  grvParamLabels: string[],
  petroConstants: Record<PetroParamKey, boolean>,
  input?: SimulationInput | null,
): RockVolumeColumn[] {
  if (isNrvDirectFromNtgConstant(petroConstants, input)) {
    return [{ kind: 'nrv_direct', label: 'Net Rock Volume' }]
  }
  return grvParamLabels
    .map((label, index) => {
      const slot = grvSlotForIndex(index)
      if (!slot) return null
      return { kind: 'grv_slot' as const, index, slot, label }
    })
    .filter((col): col is Extract<RockVolumeColumn, { kind: 'grv_slot' }> => col != null)
}

export function distributionForRockVolumeColumn(
  input: SimulationInput,
  col: RockVolumeColumn,
): DistributionSpec | null | undefined {
  if (col.kind === 'nrv_direct') {
    return input.nrv_direct_dist
  }
  return grvDistributionForIndex(input, col.index)
}

export function inputPathForGrv(
  index: number,
  petroConstants?: Record<PetroParamKey, boolean>,
  input?: SimulationInput | null,
): string {
  if (petroConstants && isNrvDirectFromNtgConstant(petroConstants, input)) {
    return `/input?sub=grv&focus=${NRV_DIRECT_FOCUS}`
  }
  const slot = grvSlotForIndex(index)
  const focus = slot ?? String(index)
  return `/input?sub=grv&focus=${focus}`
}

export function inputPathForRockVolumeColumn(col: RockVolumeColumn): string {
  if (col.kind === 'nrv_direct') {
    return `/input?sub=grv&focus=${NRV_DIRECT_FOCUS}`
  }
  return `/input?sub=grv&focus=${col.slot}`
}

export function inputPathForPetro(key: PetroParamKey): string {
  return `/input?sub=petro&focus=${key}`
}

/** Module page where the user edits distribution type and values. */
export function editorPathForRockVolumeColumn(
  col: RockVolumeColumn,
  input?: SimulationInput | null,
): string {
  if (!input || col.kind === 'nrv_direct') return '/input/rock-volume#active-tank-editor'
  const method = effectiveEstimatingMethod(input)
  switch (col.slot) {
    case 'depth':
      return method === 'nrv_grv_yield' ? '/input/rock-volume#active-tank-editor' : '/input/area'
    case 'pinchout':
      return method === 'nrv_grv_yield' ? '/input/rock-volume#active-tank-editor' : '/input/area'
    case 'owc':
      return method === 'nrv_grv_yield' ? '/input/rock-volume#active-tank-editor' : '/input/net-pay'
    default:
      return '/input/rock-volume#active-tank-editor'
  }
}

export function editorPathForPetroKey(
  key: PetroParamKey,
  input?: SimulationInput | null,
): string {
  if (key === 'ntg' && input && effectiveEstimatingMethod(input) === 'nrv_grv_yield') {
    return '/input/rock-volume#active-tank-editor'
  }
  return '/input/hc-yield'
}

export function editorLabelForPath(path: string): string {
  switch (path) {
    case '/input/rock-volume':
    case '/input/nrv':
    case '/nrv':
      return 'Rock volume'
    case '/input/area':
    case '/area':
      return 'Area'
    case '/input/net-pay':
    case '/net-pay':
      return 'Net Pay'
    case '/input/hc-yield':
    case '/input/petro/hc-yield':
    case '/hc-yield':
      return 'HC Yield'
    default:
      return 'Editor'
  }
}

export function parseInputSubTab(value: string | null): InputSubTab | null {
  return value === 'grv' || value === 'petro' ? value : null
}

export interface SetupUiSnapshot {
  grv_param_labels: string[]
  petro_param_labels: Record<PetroParamKey, string>
  petro_constants: Record<PetroParamKey, boolean>
  petro_constant_values: Record<PetroParamKey, number | null>
  /** When true, PET Evaluation appears in the petrophysical uncertainties list. */
  pet_evaluation_enabled?: boolean
  /** Display label for the PET Evaluation factor (petrophysical list). */
  pet_eval_label?: string
  /** When true, NTG constant drives direct NRV entry (not GRV x fill x NTG). */
  ntg_constant_uses_nrv_direct?: boolean
}

/** NTG constant on Setup → fixed NTG + direct net rock volume (not GRV × fill × NTG). */
export function applyNtgConstantRockVolumeMode(
  input: SimulationInput,
  ntgValue: number,
  ntgDisplayName = 'Net to Gross',
): SimulationInput {
  const base = ensureNrvDistributions({
    ...input,
    estimating_method: 'nrv_grv_yield',
    nrv_entry_mode: 'direct',
  })
  const existing = base.net_to_gross_dist
  return {
    ...base,
    net_to_gross_dist: {
      ...(existing ?? emptyDistribution('ntg', ntgDisplayName, 'fraction', 'fixed')),
      distribution_type: 'fixed',
      fixed_value: ntgValue,
      p90: null,
      p50: null,
      p10: null,
    },
  }
}

export function clearNtgConstantRockVolumeMode(input: SimulationInput): SimulationInput {
  const existing = input.net_to_gross_dist
  const next: SimulationInput = { ...input, nrv_entry_mode: 'grv_fill_ntg' }
  if (existing?.distribution_type === 'fixed') {
    return {
      ...next,
      net_to_gross_dist: {
        ...existing,
        distribution_type: 'pert',
        fixed_value: null,
        p90: existing.p90 ?? defaultPertForPetroKey('ntg').p90,
        p50: existing.p50 ?? defaultPertForPetroKey('ntg').p50,
        p10: existing.p10 ?? defaultPertForPetroKey('ntg').p10,
      },
    }
  }
  return next
}

export function defaultSetupUiSnapshot(): SetupUiSnapshot {
  return {
    grv_param_labels: [...DEFAULT_GRV_PARAM_LABELS],
    petro_param_labels: { ...DEFAULT_PETRO_PARAM_LABELS },
    petro_constants: { ntg: false, poro: false, sw: false, bo: false },
    petro_constant_values: { ntg: null, poro: null, sw: null, bo: null },
    pet_evaluation_enabled: true,
    pet_eval_label: DEFAULT_PET_EVAL_LABEL,
  }
}

export function ensurePetEvaluationDist(
  input: SimulationInput,
  label = DEFAULT_PET_EVAL_LABEL,
): SimulationInput {
  if (input.pet_evaluation_dist) return input
  return {
    ...input,
    pet_evaluation_dist: {
      ...emptyDistribution('pet_eval', label, 'fraction', 'pert'),
      p90: 0.7,
      p50: 0.85,
      p10: 1.0,
    },
  }
}
