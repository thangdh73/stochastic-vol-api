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

/** HC yield fields copied when sharing across tanks (porosity, saturation, recovery, FVF/GEF, etc.). */
export function pickSharedHcYieldFields(source: SimulationInput): Partial<SimulationInput> {
  return {
    porosity_dist: cloneDist(source.porosity_dist),
    saturation_dist: cloneDist(source.saturation_dist),
    oil_recovery_dist: cloneDist(source.oil_recovery_dist),
    fvf_dist: cloneDist(source.fvf_dist),
    gor_dist: cloneDist(source.gor_dist),
    solution_gas_recovery_dist: cloneDist(source.solution_gas_recovery_dist),
    gas_recovery_dist: cloneDist(source.gas_recovery_dist),
    gef_dist: cloneDist(source.gef_dist),
    condensate_yield_dist: cloneDist(source.condensate_yield_dist),
    apply_oil_recovery: source.apply_oil_recovery,
    include_solution_gas: source.include_solution_gas,
  }
}

export function mergeSharedHcYieldFields(
  target: SimulationInput,
  source: SimulationInput,
): SimulationInput {
  const shared = pickSharedHcYieldFields(source)
  return { ...target, ...shared }
}

/**
 * Tanks that receive linked HC yield when editing the given tank.
 * - Reservoir.shared_hc_yield: all segments in that reservoir
 * - Segment.shared_hc_yield: all reservoirs in that segment
 */
export function getHcYieldLinkedTankKeys(
  segmentId: string,
  reservoirId: string,
  segments: ReservoirSegment[],
  reservoirs: ReservoirItem[],
): string[] {
  const keys = new Set<string>()
  const reservoir = reservoirs.find((r) => r.id === reservoirId)
  const segment = segments.find((s) => s.id === segmentId)

  keys.add(tankId(segmentId, reservoirId))

  if (reservoir?.shared_hc_yield) {
    segments.forEach((seg) => keys.add(tankId(seg.id, reservoirId)))
  }
  if (segment?.shared_hc_yield) {
    reservoirs.forEach((res) => keys.add(tankId(segmentId, res.id)))
  }

  return [...keys]
}

export function applySharedHcYieldToLinkedTanks(
  prev: Record<string, SimulationInput>,
  segments: ReservoirSegment[],
  reservoirs: ReservoirItem[],
  sourceSegmentId: string,
  sourceReservoirId: string,
  sourceInput: SimulationInput,
): Record<string, SimulationInput> {
  const next = { ...prev }
  const linked = getHcYieldLinkedTankKeys(
    sourceSegmentId,
    sourceReservoirId,
    segments,
    reservoirs,
  )
  linked.forEach((key) => {
    const existing = next[key] ?? prev[key]
    if (existing) next[key] = mergeSharedHcYieldFields(existing, sourceInput)
  })
  return next
}
