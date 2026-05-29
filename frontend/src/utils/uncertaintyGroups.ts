import type { ReservoirItem, ReservoirSegment } from '../types/api'
import type {
  UncertaintyGroupMember,
  UncertaintyParameterGroup,
  UncertaintyParameterId,
} from '../types/uncertaintyGroups'
import { tankId } from './tankLabels'

export const UNCERTAINTY_PARAMETER_LABELS: Record<UncertaintyParameterId, string> = {
  grv: 'GRV',
  petrel_grv_depth: 'Depth / structure (Petrel)',
  petrel_grv_contact: 'Fluid contact (Petrel)',
  grv_percent_fill: '% trap fill',
  net_to_gross: 'Net/Gross',
  area: 'Closed area',
  percent_fill: '% fill (area)',
  net_pay: 'Net pay',
  geometric_correction: 'Geometric correction',
  porosity: 'Porosity',
  saturation: 'HC saturation (Sw)',
  oil_recovery: 'Oil recovery',
  fvf: 'Oil FVF',
  gor: 'GOR',
  solution_gas_recovery: 'Solution gas recovery',
  gas_recovery: 'Gas recovery',
  gef: 'Gas expansion factor',
  condensate_yield: 'Condensate yield',
  nrv_direct: 'NRV direct',
}

export const UNCERTAINTY_PARAMETER_OPTIONS: UncertaintyParameterId[] = [
  'grv',
  'petrel_grv_depth',
  'petrel_grv_contact',
  'grv_percent_fill',
  'net_to_gross',
  'nrv_direct',
  'area',
  'percent_fill',
  'net_pay',
  'geometric_correction',
  'porosity',
  'saturation',
  'oil_recovery',
  'fvf',
  'gor',
  'solution_gas_recovery',
  'gas_recovery',
  'gef',
  'condensate_yield',
]

export function newGroupId(): string {
  return `ug_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/** Expand group membership to concrete segment×reservoir tank keys. */
export function expandGroupTankKeys(
  group: UncertaintyParameterGroup,
  segments: ReservoirSegment[],
  reservoirs: ReservoirItem[],
): string[] {
  if (group.all_segments && group.all_reservoirs) {
    return segments.flatMap((s) => reservoirs.map((r) => tankId(s.id, r.id)))
  }
  if (group.all_segments) {
    const resIds = group.all_reservoirs
      ? reservoirs.map((r) => r.id)
      : [
          ...new Set(
            group.members.map((m) => m.reservoir_id).filter((id) => id !== '*'),
          ),
        ]
    return segments.flatMap((s) => resIds.map((rid) => tankId(s.id, rid)))
  }
  if (group.all_reservoirs) {
    const segIds = [
      ...new Set(group.members.map((m) => m.segment_id).filter((id) => id !== '*')),
    ]
    return segIds.flatMap((sid) => reservoirs.map((r) => tankId(sid, r.id)))
  }
  return [...new Set(group.members.map((m) => tankId(m.segment_id, m.reservoir_id)))]
}

export function formatSegmentScope(
  group: UncertaintyParameterGroup,
  segments: ReservoirSegment[],
): string {
  if (group.all_segments) return 'All segments'
  const names = segments
    .filter((s) => group.members.some((m) => m.segment_id === s.id))
    .map((s) => s.name)
  return names.length ? names.join(', ') : '—'
}

export function formatReservoirScope(
  group: UncertaintyParameterGroup,
  reservoirs: ReservoirItem[],
): string {
  if (group.all_reservoirs) return 'All reservoirs'
  const names = reservoirs
    .filter((r) => group.members.some((m) => m.reservoir_id === r.id))
    .map((r) => r.name)
  return names.length ? names.join(', ') : '—'
}

export function membersFromSelection(
  segmentIds: string[],
  reservoirIds: string[],
  allSegments: boolean,
  allReservoirs: boolean,
): { members: UncertaintyGroupMember[]; all_segments?: boolean; all_reservoirs?: boolean } {
  if (allSegments && allReservoirs) {
    return { members: [], all_segments: true, all_reservoirs: true }
  }
  if (allSegments) {
    const members: UncertaintyGroupMember[] = reservoirIds.map((reservoir_id) => ({
      segment_id: '*',
      reservoir_id,
    }))
    return { members, all_segments: true }
  }
  if (allReservoirs) {
    const members: UncertaintyGroupMember[] = segmentIds.map((segment_id) => ({
      segment_id,
      reservoir_id: '*',
    }))
    return { members, all_reservoirs: true }
  }
  const members: UncertaintyGroupMember[] = []
  for (const segment_id of segmentIds) {
    for (const reservoir_id of reservoirIds) {
      members.push({ segment_id, reservoir_id })
    }
  }
  return { members }
}

export function selectionFromGroup(
  group: UncertaintyParameterGroup,
  segments: ReservoirSegment[],
  reservoirs: ReservoirItem[],
): {
  segmentIds: string[]
  reservoirIds: string[]
  allSegments: boolean
  allReservoirs: boolean
} {
  if (group.all_segments && group.all_reservoirs) {
    return {
      segmentIds: segments.map((s) => s.id),
      reservoirIds: reservoirs.map((r) => r.id),
      allSegments: true,
      allReservoirs: true,
    }
  }
  if (group.all_segments) {
    return {
      segmentIds: segments.map((s) => s.id),
      reservoirIds: [
        ...new Set(
          group.members.filter((m) => m.reservoir_id !== '*').map((m) => m.reservoir_id),
        ),
      ],
      allSegments: true,
      allReservoirs: false,
    }
  }
  if (group.all_reservoirs) {
    return {
      segmentIds: [
        ...new Set(
          group.members.filter((m) => m.segment_id !== '*').map((m) => m.segment_id),
        ),
      ],
      reservoirIds: reservoirs.map((r) => r.id),
      allSegments: false,
      allReservoirs: true,
    }
  }
  return {
    segmentIds: [...new Set(group.members.map((m) => m.segment_id))],
    reservoirIds: [...new Set(group.members.map((m) => m.reservoir_id))],
    allSegments: false,
    allReservoirs: false,
  }
}

export interface GroupMembershipConflict {
  groupId: string
  groupName: string
  tankKey: string
}

/** Each tank may belong to at most one group per parameter. */
export function findMembershipConflicts(
  candidate: UncertaintyParameterGroup,
  groups: UncertaintyParameterGroup[],
  segments: ReservoirSegment[],
  reservoirs: ReservoirItem[],
): GroupMembershipConflict[] {
  const keys = expandGroupTankKeys(candidate, segments, reservoirs)
  const conflicts: GroupMembershipConflict[] = []
  for (const other of groups) {
    if (other.id === candidate.id) continue
    if (other.parameter !== candidate.parameter) continue
    const otherKeys = expandGroupTankKeys(other, segments, reservoirs)
    for (const tankKey of keys) {
      if (otherKeys.includes(tankKey)) {
        conflicts.push({ groupId: other.id, groupName: other.name, tankKey })
      }
    }
  }
  return conflicts
}

export function suggestGroupName(
  parameter: UncertaintyParameterId,
  segmentNames: string[],
  reservoirNames: string[],
  allSegments: boolean,
  allReservoirs: boolean,
): string {
  const paramShort: Record<UncertaintyParameterId, string> = {
    grv: 'GRV',
    petrel_grv_depth: 'Struct',
    petrel_grv_contact: 'Contact',
    grv_percent_fill: 'Fill',
    net_to_gross: 'NTG',
    area: 'Area',
    percent_fill: 'Fill',
    net_pay: 'NP',
    geometric_correction: 'Geom',
    porosity: 'Poro',
    saturation: 'Sw',
    oil_recovery: 'Rec',
    fvf: 'FVF',
    gor: 'GOR',
    solution_gas_recovery: 'SGR',
    gas_recovery: 'GasRec',
    gef: 'GEF',
    condensate_yield: 'CY',
    nrv_direct: 'NRV',
  }
  const p = paramShort[parameter] ?? parameter
  const resPart = allReservoirs
    ? 'allRes'
    : reservoirNames.map((n) => n.replace(/\s+/g, '')).join('_') || 'Res'
  const segPart = allSegments
    ? 'allSeg'
    : segmentNames.map((n) => n.replace(/\s+/g, '')).join(',') || 'Seg'
  return `${p}_${resPart}_${segPart}`
}
