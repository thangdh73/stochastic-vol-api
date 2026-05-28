import type {
  ReservoirItem,
  ReservoirSegment,
  SimulationInput,
} from '../types/api'
import { tankId } from './tankLabels'
import type { DistributionSpec } from '../types/api'

function cloneDist(dist: DistributionSpec | null | undefined): DistributionSpec | null {
  if (!dist) return null
  return JSON.parse(JSON.stringify(dist)) as DistributionSpec
}

/** NTG (+ GRV–NTG correlation) fields copied when sharing across tanks. */
export function pickSharedNtgFields(source: SimulationInput): Partial<SimulationInput> {
  return {
    net_to_gross_dist: cloneDist(source.net_to_gross_dist),
    grv_ntg_correlation: source.grv_ntg_correlation,
  }
}

export function mergeSharedNtgFields(
  target: SimulationInput,
  source: SimulationInput,
): SimulationInput {
  const shared = pickSharedNtgFields(source)
  return { ...target, ...shared }
}

/**
 * Tanks that receive linked NTG when editing the given tank.
 * - Reservoir.shared_ntg: all segments in that reservoir (e.g. R1-S1 ↔ R1-S2)
 * - Segment.shared_ntg: all reservoirs in that segment (e.g. R1-S1 ↔ R2-S1)
 */
export function getNtgLinkedTankKeys(
  segmentId: string,
  reservoirId: string,
  segments: ReservoirSegment[],
  reservoirs: ReservoirItem[],
): string[] {
  const keys = new Set<string>()
  const reservoir = reservoirs.find((r) => r.id === reservoirId)
  const segment = segments.find((s) => s.id === segmentId)

  keys.add(tankId(segmentId, reservoirId))

  if (reservoir?.shared_ntg) {
    segments.forEach((seg) => keys.add(tankId(seg.id, reservoirId)))
  }
  if (segment?.shared_ntg) {
    reservoirs.forEach((res) => keys.add(tankId(segmentId, res.id)))
  }

  return [...keys]
}

export function applySharedNtgToLinkedTanks(
  prev: Record<string, SimulationInput>,
  segments: ReservoirSegment[],
  reservoirs: ReservoirItem[],
  sourceSegmentId: string,
  sourceReservoirId: string,
  sourceInput: SimulationInput,
): Record<string, SimulationInput> {
  const next = { ...prev }
  const linked = getNtgLinkedTankKeys(
    sourceSegmentId,
    sourceReservoirId,
    segments,
    reservoirs,
  )
  linked.forEach((key) => {
    const existing = next[key] ?? prev[key]
    if (existing) next[key] = mergeSharedNtgFields(existing, sourceInput)
  })
  return next
}
