import type {
  GroupCorrelationMatrix,
  GroupCorrelationMode,
  UncertaintyParameterGroup,
} from '../types/uncertaintyGroups'
import { cellHeatColor } from './correlations'

export { cellHeatColor }

export interface GroupCorrelationSummary {
  /** Mode actually applied during MC (rank / gaussian_copula make the matrix active). */
  mode: GroupCorrelationMode
  /** True when the matrix is non-trivial AND the mode applies it during sampling. */
  active: boolean
  /** Non-zero off-diagonal unique pairs in the matrix. */
  totalPairs: number
  /** Non-zero pairs between a porosity group and a saturation (Sw) group. */
  poroSwPairs: number
}

/** Count non-zero off-diagonal pairs in the group correlation matrix, plus Poro–Sw pairs. */
export function summarizeGroupCorrelation(
  matrix: GroupCorrelationMatrix | null,
  groups: UncertaintyParameterGroup[],
  mode: GroupCorrelationMode,
): GroupCorrelationSummary {
  const empty: GroupCorrelationSummary = {
    mode,
    active: false,
    totalPairs: 0,
    poroSwPairs: 0,
  }
  if (!matrix || !matrix.group_ids.length) return empty

  const paramById = new Map(groups.map((g) => [g.id, g.parameter]))
  let totalPairs = 0
  let poroSwPairs = 0
  const ids = matrix.group_ids
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const rho = matrix.values[i]?.[j] ?? 0
      if (Math.abs(rho) < 1e-9) continue
      totalPairs += 1
      const a = paramById.get(ids[i])
      const b = paramById.get(ids[j])
      const isPoroSw =
        (a === 'porosity' && b === 'saturation') ||
        (a === 'saturation' && b === 'porosity')
      if (isPoroSw) poroSwPairs += 1
    }
  }

  const applies = mode === 'rank' || mode === 'gaussian_copula'
  return {
    mode,
    active: applies && totalPairs > 0,
    totalPairs,
    poroSwPairs,
  }
}

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
