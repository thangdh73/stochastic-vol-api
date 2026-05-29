import type { DistributionSpec, ReservoirItem, ReservoirSegment, SimulationInput } from '../types/api'
import { tankId } from './tankLabels'

export type TankCopyScope = 'reservoir' | 'segment' | 'all'

const DISTRIBUTION_FIELD_KEYS = [
  'area_dist',
  'percent_fill_dist',
  'net_pay_dist',
  'geometric_correction_dist',
  'porosity_dist',
  'saturation_dist',
  'oil_recovery_dist',
  'fvf_dist',
  'gor_dist',
  'solution_gas_recovery_dist',
  'gas_recovery_dist',
  'gef_dist',
  'condensate_yield_dist',
  'grv_dist',
  'grv_percent_fill_dist',
  'net_to_gross_dist',
  'nrv_direct_dist',
  'nrv_direct_multiplier_dist',
  'cross_check_area_dist',
] as const satisfies readonly (keyof SimulationInput)[]

const WORKFLOW_FIELD_KEYS = [
  'estimating_method',
  'nrv_entry_mode',
  'fluid_type',
  'grv_ntg_correlation',
  'cross_check_enabled',
  'area_input_unit',
  'grv_input_unit',
  'nrv_input_unit',
  'apply_oil_recovery',
  'include_solution_gas',
] as const satisfies readonly (keyof SimulationInput)[]

function cloneDist(dist: DistributionSpec | null | undefined): DistributionSpec | null {
  if (!dist) return null
  return JSON.parse(JSON.stringify(dist)) as DistributionSpec
}

const ROCK_VOLUME_FIELD_KEYS = [
  'area_dist',
  'percent_fill_dist',
  'net_pay_dist',
  'grv_dist',
  'grv_percent_fill_dist',
  'net_to_gross_dist',
  'nrv_direct_dist',
  'nrv_direct_multiplier_dist',
  'grv_ntg_correlation',
  'nrv_entry_mode',
  'estimating_method',
  'grv_input_unit',
  'nrv_input_unit',
  'area_input_unit',
] as const satisfies readonly (keyof SimulationInput)[]

/** Rock volume fields only (GRV/NRV/area/net pay) — not HC yield. */
export function pickRockVolumeTankFields(source: SimulationInput): Partial<SimulationInput> {
  const partial: Partial<SimulationInput> = {}
  for (const key of ROCK_VOLUME_FIELD_KEYS) {
    const value = source[key]
    if (value !== undefined) {
      ;(partial as Record<string, unknown>)[key] =
        typeof value === 'object' && value !== null && 'distribution_type' in value
          ? cloneDist(value as DistributionSpec)
          : value
    }
  }
  return partial
}

export function mergeRockVolumeFromSource(
  target: SimulationInput,
  source: SimulationInput,
): SimulationInput {
  return { ...target, ...pickRockVolumeTankFields(source) }
}

/** Distribution and workflow fields copied from a source tank to targets. */
export function pickCopyableTankFields(source: SimulationInput): Partial<SimulationInput> {
  const partial: Partial<SimulationInput> = {}
  for (const key of DISTRIBUTION_FIELD_KEYS) {
    const value = source[key]
    if (value !== undefined) {
      ;(partial as Record<string, unknown>)[key] = cloneDist(value as DistributionSpec | null)
    }
  }
  for (const key of WORKFLOW_FIELD_KEYS) {
    const value = source[key]
    if (value !== undefined) {
      ;(partial as Record<string, unknown>)[key] = value
    }
  }
  return partial
}

export function mergeTankDistributionsFromSource(
  target: SimulationInput,
  source: SimulationInput,
): SimulationInput {
  return { ...target, ...pickCopyableTankFields(source) }
}

export function listTanksInScope(
  scope: TankCopyScope,
  activeSegmentId: string,
  activeReservoirId: string,
  segments: ReservoirSegment[],
  reservoirs: ReservoirItem[],
): Array<{ segmentId: string; reservoirId: string; key: string }> {
  const out: Array<{ segmentId: string; reservoirId: string; key: string }> = []
  for (const seg of segments) {
    for (const res of reservoirs) {
      if (!res.enabled) continue
      if (scope === 'reservoir' && res.id !== activeReservoirId) continue
      if (scope === 'segment' && seg.id !== activeSegmentId) continue
      out.push({
        segmentId: seg.id,
        reservoirId: res.id,
        key: tankId(seg.id, res.id),
      })
    }
  }
  return out
}

export function tankCopyScopeLabel(scope: TankCopyScope): string {
  switch (scope) {
    case 'reservoir':
      return 'all segments in this reservoir'
    case 'segment':
      return 'all reservoirs in this segment'
    case 'all':
      return 'every segment × reservoir tank'
    default:
      return scope
  }
}
