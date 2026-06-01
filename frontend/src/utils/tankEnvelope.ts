import type {
  ReservoirItem,
  ReservoirSegment,
  SimulationInput,
} from '../types/api'
import type {
  GroupCorrelationMatrix,
  GroupCorrelationMode,
  UncertaintyParameterGroup,
} from '../types/uncertaintyGroups'
import type { SetupUiSnapshot } from './setupInputParams'
import type { PetrelCumulativeGrvBlock } from '../types/api'

export interface TankProjectEnvelope {
  schema_version: '1'
  segments: ReservoirSegment[]
  reservoirs: ReservoirItem[]
  tank_inputs: Record<string, SimulationInput>
  active_segment_id: string | null
  active_reservoir_id: string | null
  /** Named uncertainty drivers (porosity compartments, prospect GRV, etc.). */
  uncertainty_groups?: UncertaintyParameterGroup[]
  group_correlation_matrix?: GroupCorrelationMatrix | null
  group_correlation_mode?: GroupCorrelationMode
  /** Setup ↔ Input parameter labels and constants. */
  setup_ui?: SetupUiSnapshot
  /** Prospect-wide Petrel cumulative GRV matrix (1P/2P/3P + structure scale). */
  petrel_cumulative_grv?: PetrelCumulativeGrvBlock
  /** When set, overrides per-tank nrv_entry_mode for rock volume workflow. */
  rock_volume_mode?: 'petrel_cumulative_structure'
}

export const TANK_ENVELOPE_META_KEY = 'tank_envelope_v1'

export function isTankEnvelope(value: unknown): value is TankProjectEnvelope {
  if (!value || typeof value !== 'object') return false
  const v = value as TankProjectEnvelope
  return (
    v.schema_version === '1' &&
    Array.isArray(v.segments) &&
    Array.isArray(v.reservoirs) &&
    typeof v.tank_inputs === 'object' &&
    v.tank_inputs !== null
  )
}

export function envelopeFromMetadata(
  metadata: Record<string, unknown> | undefined,
): TankProjectEnvelope | null {
  if (!metadata) return null
  const raw = metadata[TANK_ENVELOPE_META_KEY]
  return isTankEnvelope(raw) ? raw : null
}
