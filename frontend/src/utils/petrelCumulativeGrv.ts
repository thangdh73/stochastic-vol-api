import type { RockVolumeInputUnit, SimulationInput } from '../types/api'
import type { PetrelCumulativeGrvBlock, PetrelCumulativeSegmentRow } from '../types/api'
import { tankId } from './tankLabels'

/** Default structure scale: Deposit 1A vs other deposits (guide). */
export function defaultStructureScale(segmentLabel: string): {
  scale_low: number
  scale_mode: number
  scale_high: number
} {
  const name = segmentLabel.trim().toLowerCase()
  if (name.includes('1a') || name === 'deposit 1a') {
    return { scale_low: 0.75, scale_mode: 1.0, scale_high: 1.28 }
  }
  return { scale_low: 0.85, scale_mode: 1.0, scale_high: 1.17 }
}

export function emptyPetrelCumulativeRow(
  tankKey: string,
  segmentLabel: string,
): PetrelCumulativeSegmentRow {
  const scale = defaultStructureScale(segmentLabel)
  return {
    tank_key: tankKey,
    grv_1p: 0,
    grv_2p: 0,
    grv_3p: 0,
    ...scale,
    enabled: true,
  }
}

export function ensurePetrelCumulativeGrvBlock(
  block: PetrelCumulativeGrvBlock | undefined,
  segmentIds: Array<{ id: string; name: string; enabled?: boolean }>,
  reservoirIds: string[],
): PetrelCumulativeGrvBlock {
  const segments: Record<string, PetrelCumulativeSegmentRow> = { ...(block?.segments ?? {}) }
  for (const seg of segmentIds) {
    for (const resId of reservoirIds) {
      const key = tankId(seg.id, resId)
      if (!segments[key]) {
        segments[key] = emptyPetrelCumulativeRow(key, seg.name)
      }
    }
  }
  return {
    independent_structure_scale: block?.independent_structure_scale ?? false,
    segments,
    last_run: block?.last_run,
  }
}

export function incrementGrv(row: PetrelCumulativeSegmentRow): {
  p1_inc: number
  p2_inc: number
  p3_inc: number
} {
  return {
    p1_inc: row.grv_1p,
    p2_inc: row.grv_2p - row.grv_1p,
    p3_inc: row.grv_3p - row.grv_2p,
  }
}

export function rowGrvValid(row: PetrelCumulativeSegmentRow): boolean {
  const { p1_inc, p2_inc, p3_inc } = incrementGrv(row)
  if (row.grv_1p < 0 || row.grv_2p < 0 || row.grv_3p < 0) return false
  if (row.grv_1p > row.grv_2p || row.grv_2p > row.grv_3p) return false
  if (p1_inc < 0 || p2_inc < 0 || p3_inc < 0) return false
  if (row.scale_low <= 0 || row.scale_mode <= 0 || row.scale_high <= 0) return false
  if (row.scale_low > row.scale_mode || row.scale_mode > row.scale_high) return false
  return true
}

export function scaledGrvPreview2p(row: PetrelCumulativeSegmentRow): {
  low: number
  mode: number
  high: number
} {
  return {
    low: row.grv_2p * row.scale_low,
    mode: row.grv_2p * row.scale_mode,
    high: row.grv_2p * row.scale_high,
  }
}

export function isPetrelCumulativeMode(input: SimulationInput | null | undefined): boolean {
  return input?.nrv_entry_mode === 'petrel_cumulative_structure'
}

export function prospectUsesPetrelCumulative(
  tankInputs: Record<string, SimulationInput>,
): boolean {
  return Object.values(tankInputs).some(isPetrelCumulativeMode)
}

export function buildSegmentRowsForApi(
  block: PetrelCumulativeGrvBlock,
  segments: Array<{ id: string; name: string; enabled?: boolean }>,
  reservoirs: Array<{ id: string; enabled?: boolean }>,
): PetrelCumulativeSegmentRow[] {
  const rows: PetrelCumulativeSegmentRow[] = []
  for (const seg of segments) {
    for (const res of reservoirs) {
      if (res.enabled === false) continue
      const key = tankId(seg.id, res.id)
      const row = block.segments[key] ?? emptyPetrelCumulativeRow(key, seg.name)
      rows.push({
        ...row,
        tank_key: key,
        segment_id: seg.id,
        reservoir_id: res.id,
        label: seg.name,
        enabled: seg.enabled !== false && row.enabled !== false,
      })
    }
  }
  return rows
}

/**
 * Petrel cumulative GRV uses the standard SPE proven/probable/possible categories.
 * These are NOT the Setup GRV-uncertainty source names (Depth, Pinchout, Fluid contact).
 */
export function categoryLabels(): [string, string, string] {
  return ['1P', '2P', '3P']
}

export function parseGrvPasteLine(line: string): number[] | null {
  const parts = line
    .split(/[\t,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length < 3) return null
  const nums = parts.slice(0, 3).map((p) => Number(p.replace(/,/g, '')))
  if (nums.some((n) => !Number.isFinite(n))) return null
  return nums
}

export function applyGrvUnitToTank(
  input: SimulationInput,
  unit: RockVolumeInputUnit,
): SimulationInput {
  return { ...input, grv_input_unit: unit, nrv_entry_mode: 'petrel_cumulative_structure' }
}
