import { NumericInput } from './NumericInput'
import type { GroupCorrelationMatrix } from '../types/uncertaintyGroups'
import type { UncertaintyParameterGroup } from '../types/uncertaintyGroups'
import { cellHeatColor, groupMatrixCell } from '../utils/groupCorrelations'

interface GroupCorrelationMatrixGridProps {
  matrix: GroupCorrelationMatrix
  groups: UncertaintyParameterGroup[]
  disabled?: boolean
  onCellChange: (rowGroupId: string, colGroupId: string, rho: number) => void
}

export function GroupCorrelationMatrixGrid({
  matrix,
  groups,
  disabled = false,
  onCellChange,
}: GroupCorrelationMatrixGridProps) {
  const nameById = new Map(groups.map((g) => [g.id, g.name]))

  return (
    <div className="corr-matrix-wrap">
      <table className="corr-matrix">
        <thead>
          <tr>
            <th className="corr-matrix-corner" />
            {matrix.group_ids.map((gid) => (
              <th key={gid} className="corr-matrix-col-head" title={gid}>
                {nameById.get(gid) ?? gid}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.group_ids.map((rowId) => (
            <tr key={rowId}>
              <th className="corr-matrix-row-head" title={rowId}>
                {nameById.get(rowId) ?? rowId}
              </th>
              {matrix.group_ids.map((colId) => {
                const rho = groupMatrixCell(matrix, rowId, colId)
                const isDiag = rowId === colId
                return (
                  <td
                    key={colId}
                    className={isDiag ? 'corr-matrix-diag' : 'corr-matrix-cell'}
                    style={
                      isDiag ? undefined : { backgroundColor: cellHeatColor(rho) }
                    }
                  >
                    {isDiag ? (
                      <span className="corr-matrix-one">1</span>
                    ) : (
                      <NumericInput
                        allowEmpty={false}
                        value={rho}
                        disabled={disabled}
                        onChange={(v) => {
                          if (v != null) onCellChange(rowId, colId, v)
                        }}
                      />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
