import type {
  CorrelationPair,
  ReservoirItem,
  ReservoirSegment,
  SimulationInput,
} from '../types/api'
import { syncCorrelationMatrix } from './correlations'
import { tankId } from './tankLabels'

function cloneCorrelations(correlations: CorrelationPair[] | undefined): CorrelationPair[] {
  if (!correlations?.length) return []
  return JSON.parse(JSON.stringify(correlations)) as CorrelationPair[]
}

/**
 * Correlation settings copied when sharing across tanks (mode, pairs, matrix).
 * GRV↔NTG rank ρ on the NRV tab is separate (see tankNrvShared).
 */
export function pickSharedCorrelationFields(
  source: SimulationInput,
): Partial<SimulationInput> {
  return {
    correlation_mode: source.correlation_mode,
    correlations: cloneCorrelations(source.correlations),
  }
}

export function mergeSharedCorrelationFields(
  target: SimulationInput,
  source: SimulationInput,
): SimulationInput {
  const merged: SimulationInput = {
    ...target,
    ...pickSharedCorrelationFields(source),
  }
  return syncCorrelationMatrix(merged)
}

/**
 * Tanks that receive linked correlations when editing the given tank.
 * - Reservoir.shared_correlation: all segments in that reservoir (e.g. R1-S1 ↔ R1-S2)
 * - Segment.shared_correlation: all reservoirs in that segment (e.g. R1-S1 ↔ R2-S1)
 */
export function getCorrelationLinkedTankKeys(
  segmentId: string,
  reservoirId: string,
  segments: ReservoirSegment[],
  reservoirs: ReservoirItem[],
): string[] {
  const keys = new Set<string>()
  const reservoir = reservoirs.find((r) => r.id === reservoirId)
  const segment = segments.find((s) => s.id === segmentId)

  keys.add(tankId(segmentId, reservoirId))

  if (reservoir?.shared_correlation) {
    segments.forEach((seg) => keys.add(tankId(seg.id, reservoirId)))
  }
  if (segment?.shared_correlation) {
    reservoirs.forEach((res) => keys.add(tankId(segmentId, res.id)))
  }

  return [...keys]
}

export function applySharedCorrelationToLinkedTanks(
  prev: Record<string, SimulationInput>,
  segments: ReservoirSegment[],
  reservoirs: ReservoirItem[],
  sourceSegmentId: string,
  sourceReservoirId: string,
  sourceInput: SimulationInput,
): Record<string, SimulationInput> {
  const next = { ...prev }
  const linked = getCorrelationLinkedTankKeys(
    sourceSegmentId,
    sourceReservoirId,
    segments,
    reservoirs,
  )
  linked.forEach((key) => {
    const existing = next[key] ?? prev[key]
    if (existing) next[key] = mergeSharedCorrelationFields(existing, sourceInput)
  })
  return next
}
