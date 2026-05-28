import type { SimulationInput } from '../types/api'
import {
  buildCorrelationMatrix,
  cellHeatColor,
  correlatableVariables,
  setMatrixCell,
  VARIABLE_LABELS,
} from '../utils/correlations'
import { NumericInput } from './NumericInput'

interface CorrelationMatrixGridProps {
  input: SimulationInput
  disabled?: boolean
  onChange: (input: SimulationInput) => void
}

export function CorrelationMatrixGrid({
  input,
  disabled = false,
  onChange,
}: CorrelationMatrixGridProps) {
  const matrix = input.correlation_matrix ?? buildCorrelationMatrix(input)
  const variables = matrix.variables.length
    ? matrix.variables
    : correlatableVariables(input)

  const handleCell = (row: string, col: string, v: number | null) => {
    if (row === col || disabled || v == null) return
    onChange(setMatrixCell(input, row, col, Math.min(1, Math.max(-1, v))))
  }

  return (
    <div className="corr-matrix-wrap">
      <table className="corr-matrix">
        <thead>
          <tr>
            <th className="corr-matrix-corner" />
            {variables.map((vid) => (
              <th key={vid} className="corr-matrix-col-head" title={vid}>
                {VARIABLE_LABELS[vid] ?? vid}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {variables.map((rowVar, i) => (
            <tr key={rowVar}>
              <th className="corr-matrix-row-head" title={rowVar}>
                {VARIABLE_LABELS[rowVar] ?? rowVar}
              </th>
              {variables.map((colVar, j) => {
                const rho =
                  rowVar === colVar ? 1 : (matrix.values[i]?.[j] ?? 0)
                const isDiag = rowVar === colVar
                return (
                  <td
                    key={colVar}
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
                        onChange={(v) => handleCell(rowVar, colVar, v)}
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
