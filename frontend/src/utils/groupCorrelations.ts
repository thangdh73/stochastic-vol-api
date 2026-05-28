import type { GroupCorrelationMatrix } from '../types/uncertaintyGroups'
import type { UncertaintyParameterGroup } from '../types/uncertaintyGroups'
import { cellHeatColor } from './correlations'

export { cellHeatColor }

export function buildEmptyGroupMatrix(
  groupIds: string[],
): GroupCorrelationMatrix {
  const n = groupIds.length
  const values = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  )
  return { group_ids: [...groupIds], values }
}

/** Preserve ρ for pairs that still exist when groups are added/removed/renamed. */
export function syncGroupCorrelationMatrix(
  existing: GroupCorrelationMatrix | null,
  groups: UncertaintyParameterGroup[],
): GroupCorrelationMatrix | null {
  if (!groups.length) return null
  const ids = groups.map((g) => g.id)
  const prevIds = existing?.group_ids ?? []
  const prevValues = existing?.values ?? []
  const n = ids.length
  const values: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 1
      const oldI = prevIds.indexOf(ids[i])
      const oldJ = prevIds.indexOf(ids[j])
      if (oldI >= 0 && oldJ >= 0) {
        return prevValues[oldI]?.[oldJ] ?? 0
      }
      return 0
    }),
  )
  return { group_ids: ids, values }
}

export function setGroupMatrixCell(
  matrix: GroupCorrelationMatrix,
  rowGroupId: string,
  colGroupId: string,
  rho: number,
): GroupCorrelationMatrix {
  if (rowGroupId === colGroupId) return matrix
  const i = matrix.group_ids.indexOf(rowGroupId)
  const j = matrix.group_ids.indexOf(colGroupId)
  if (i < 0 || j < 0) return matrix
  const clamped = Math.max(-1, Math.min(1, rho))
  const values = matrix.values.map((row, ri) =>
    row.map((cell, ci) => {
      if ((ri === i && ci === j) || (ri === j && ci === i)) return clamped
      return cell
    }),
  )
  return { ...matrix, values }
}

export function groupMatrixCell(
  matrix: GroupCorrelationMatrix,
  rowGroupId: string,
  colGroupId: string,
): number {
  if (rowGroupId === colGroupId) return 1
  const i = matrix.group_ids.indexOf(rowGroupId)
  const j = matrix.group_ids.indexOf(colGroupId)
  if (i < 0 || j < 0) return 0
  return matrix.values[i]?.[j] ?? 0
}
