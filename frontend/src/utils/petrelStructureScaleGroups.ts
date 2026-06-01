import type { ReservoirItem, ReservoirSegment } from '../types/api'
import type { UncertaintyParameterGroup } from '../types/uncertaintyGroups'
import { syncGroupCorrelationMatrix } from './groupCorrelations'
import type { GroupCorrelationMatrix } from '../types/uncertaintyGroups'

export const DEFAULT_PETREL_STRUCTURE_GROUP_ID = 'structure_scale_uma1015_all'

/** Default: all segments share one structure-scale percentile draw per iteration. */
export function buildDefaultPetrelStructureScaleGroup(
  segments: ReservoirSegment[],
  reservoirs: ReservoirItem[],
): UncertaintyParameterGroup {
  void segments
  void reservoirs
  return {
    id: DEFAULT_PETREL_STRUCTURE_GROUP_ID,
    name: 'StructureScale_UMA1015_All',
    parameter: 'petrel_structure_scale',
    members: [],
    all_segments: true,
    all_reservoirs: true,
    notes:
      'Linked triangular structure scale for Petrel cumulative GRV (one percentile per iteration, per-segment triangular bounds).',
  }
}

export function hasPetrelStructureScaleGroup(
  groups: UncertaintyParameterGroup[],
): boolean {
  return groups.some((g) => g.parameter === 'petrel_structure_scale')
}

export function ensurePetrelStructureScaleGroups(
  groups: UncertaintyParameterGroup[],
  segments: ReservoirSegment[],
  reservoirs: ReservoirItem[],
): UncertaintyParameterGroup[] {
  if (hasPetrelStructureScaleGroup(groups)) return groups
  return [buildDefaultPetrelStructureScaleGroup(segments, reservoirs), ...groups]
}

export function applyPetrelStructureScaleDefaultGroups(
  groups: UncertaintyParameterGroup[],
  segments: ReservoirSegment[],
  reservoirs: ReservoirItem[],
  matrix: GroupCorrelationMatrix | null,
): {
  groups: UncertaintyParameterGroup[]
  matrix: GroupCorrelationMatrix | null
} {
  const nextGroups = ensurePetrelStructureScaleGroups(groups, segments, reservoirs)
  return {
    groups: nextGroups,
    matrix: syncGroupCorrelationMatrix(matrix, nextGroups),
  }
}
