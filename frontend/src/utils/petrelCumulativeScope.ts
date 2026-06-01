import type {
  PetrelCumulativeCategorySummary,
  PetrelCumulativeRunResult,
} from '../types/api'

export type PetrelScopeType = 'field' | 'reservoir' | 'segment' | 'tank'

export type PetrelCategory = '1P' | '2P' | '3P'

export const PETREL_CATEGORIES: PetrelCategory[] = ['1P', '2P', '3P']

export interface PetrelScopeOption {
  type: PetrelScopeType
  id: string
  label: string
}

export interface PetrelScopeValues {
  values: number[]
  summary: PetrelCumulativeCategorySummary
  unit: string
}

const FIELD_ARRAY_KEYS: Record<PetrelCategory, string> = {
  '1P': 'total_giip_1p',
  '2P': 'total_giip_2p',
  '3P': 'total_giip_3p',
}

function quantileAsc(sortedAsc: number[], q: number): number {
  if (!sortedAsc.length) return 0
  if (sortedAsc.length === 1) return sortedAsc[0]
  const pos = (sortedAsc.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sortedAsc[lo]
  const frac = pos - lo
  return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac
}

/** Petroleum convention: P90 = low (90% exceedance), P10 = high (10% exceedance). */
function summaryFromValues(values: number[], unit: string): PetrelCumulativeCategorySummary {
  if (!values.length) {
    return { p90: 0, p50: 0, mean_trimmed: 0, p10: 0, unit }
  }
  const sorted = [...values].sort((a, b) => a - b)
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length
  return {
    p90: quantileAsc(sorted, 0.1),
    p50: quantileAsc(sorted, 0.5),
    mean_trimmed: mean,
    p10: quantileAsc(sorted, 0.9),
    unit,
  }
}

function segmentArrayKey(tankKey: string, category: PetrelCategory): string {
  return `${tankKey}::giip_${category.toLowerCase()}`
}

function sumArrays(arrays: number[][]): number[] {
  if (!arrays.length) return []
  const n = arrays[0].length
  const out = new Array<number>(n).fill(0)
  for (const arr of arrays) {
    const len = Math.min(n, arr.length)
    for (let i = 0; i < len; i += 1) out[i] += arr[i]
  }
  return out
}

/** Scope options grouped by type, derived from the run result segments. */
export function buildPetrelScopeOptions(
  result: PetrelCumulativeRunResult,
): Record<PetrelScopeType, PetrelScopeOption[]> {
  const reservoirs = new Map<string, string>()
  const segmentsById = new Map<string, string>()
  const tanks: PetrelScopeOption[] = []

  for (const seg of result.segments) {
    const resId = seg.reservoir_id || 'reservoir'
    if (!reservoirs.has(resId)) reservoirs.set(resId, resId)
    const segId = seg.segment_id || seg.tank_key
    if (!segmentsById.has(segId)) segmentsById.set(segId, seg.label || segId)
    tanks.push({ type: 'tank', id: seg.tank_key, label: seg.label || seg.tank_key })
  }

  return {
    field: [{ type: 'field', id: 'field', label: 'Field total' }],
    reservoir: [...reservoirs.entries()].map(([id, label]) => ({
      type: 'reservoir',
      id,
      label,
    })),
    segment: [...segmentsById.entries()].map(([id, label]) => ({
      type: 'segment',
      id,
      label,
    })),
    tank: tanks,
  }
}

/** Resolve iteration values + summary for a scope selection and category. */
export function getPetrelScopeValues(
  result: PetrelCumulativeRunResult,
  scopeType: PetrelScopeType,
  scopeId: string,
  category: PetrelCategory,
): PetrelScopeValues | null {
  const arrays = result.arrays
  if (!arrays) return null
  const unit = result.gas_unit

  if (scopeType === 'field') {
    const values = arrays[FIELD_ARRAY_KEYS[category]]
    if (!values?.length) return null
    return { values, summary: result.field[category], unit: result.field[category].unit }
  }

  if (scopeType === 'tank') {
    const seg = result.segments.find((s) => s.tank_key === scopeId)
    if (!seg) return null
    const values = arrays[segmentArrayKey(seg.tank_key, category)]
    if (!values?.length) return null
    return { values, summary: seg[category], unit: seg[category].unit }
  }

  // reservoir / segment: aggregate member segment arrays element-wise.
  const members = result.segments.filter((s) =>
    scopeType === 'reservoir' ? s.reservoir_id === scopeId : s.segment_id === scopeId,
  )
  if (!members.length) return null
  const memberArrays = members
    .map((s) => arrays[segmentArrayKey(s.tank_key, category)])
    .filter((a): a is number[] => Boolean(a?.length))
  if (!memberArrays.length) return null

  if (memberArrays.length === 1) {
    const only = members[0]
    return { values: memberArrays[0], summary: only[category], unit: only[category].unit }
  }
  const values = sumArrays(memberArrays)
  return { values, summary: summaryFromValues(values, unit), unit }
}

const SCOPE_TYPE_LABELS: Record<PetrelScopeType, string> = {
  field: 'Field',
  reservoir: 'Reservoir',
  segment: 'Segment',
  tank: 'Tank',
}

export function scopeTypeLabel(type: PetrelScopeType): string {
  return SCOPE_TYPE_LABELS[type]
}
