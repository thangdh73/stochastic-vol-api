import { Link } from 'react-router-dom'
import type { SimulationInput } from '../types/api'
import { effectiveEstimatingMethod } from '../utils/estimatingMethod'
import { isNrvDirectFromNtgConstant, type PetroParamKey } from '../utils/setupInputParams'

type Props = {
  input: SimulationInput
  petroConstants: Record<PetroParamKey, boolean>
  compact?: boolean
}

export function InputParameterGuide({ input, petroConstants, compact = false }: Props) {
  const method = effectiveEstimatingMethod(input)
  const nrvDirect = isNrvDirectFromNtgConstant(petroConstants, input)

  if (compact) {
    return (
      <p className="convention-inline input-param-guide-compact">
        <strong>This table is a summary only.</strong> Pick segment and reservoir above, then use{' '}
        <strong>Edit</strong> on a column to set <strong>distribution type</strong> and values. L = P90,
        B = P50, H = P10.
      </p>
    )
  }

  return (
    <div className="card input-param-guide">
      <h2>How to set parameters and distribution types</h2>
      <ol className="input-param-guide-steps">
        <li>
          Select the <strong>segment</strong> and <strong>reservoir</strong> you want to edit (strip
          above the table).
        </li>
        <li>
          On the <strong>Input</strong> tab, use this table to see P90 / P50 / P10 (shown as L / B /
          H). You cannot type into these cells.
        </li>
        <li>
          Click <strong>Edit …</strong> on a column heading (or <strong>→</strong> on Setup) to open
          the editor page for that parameter.
        </li>
        <li>
          On the editor page, choose <strong>Distribution type</strong>:
          <ul>
            <li>
              <strong>Fixed</strong> — one value only (like Setup Constants).
            </li>
            <li>
              <strong>Lognormal / PERT / Triangular / …</strong> — enter P90, P50, and P10 (P90 =
              conservative, P10 = upside).
            </li>
          </ul>
        </li>
        <li>
          Return to <strong>Input</strong> to check all tanks, then <strong>Validate</strong> and run{' '}
          <Link to="/simulation">Simulation</Link>.
        </li>
      </ol>
      <div className="input-param-guide-map">
        <strong>Many segments and reservoirs (e.g. 30 × 30)</strong>
        <p className="convention-inline" style={{ margin: '0.35rem 0' }}>
          Each cell in the matrix is one <strong>tank</strong> with its own distributions. Use the
          bulk panel on this page: turn on <strong>NTG↔Seg</strong> / <strong>HC↔Seg</strong> on{' '}
          <Link to="/setup">Setup</Link> so one edit updates a whole reservoir column, then{' '}
          <strong>Copy from active tank</strong> for parameters that must differ per tank (e.g. GRV).
          Review all tanks in the table below.
        </p>
      </div>
      <div className="input-param-guide-map">
        <strong>Where each parameter is edited</strong>
        {nrvDirect ? (
          <ul>
            <li>
              <strong>Net Rock Volume</strong> — <Link to="/nrv">NRV / GRV</Link> → Direct NRV
            </li>
            <li>
              <strong>NTG (constant)</strong> — value on <Link to="/setup">Setup</Link> → Constants
            </li>
            <li>
              <strong>PORO, Sw, Bo</strong> — <Link to="/hc-yield">HC Yield</Link>
            </li>
          </ul>
        ) : method === 'nrv_grv_yield' ? (
          <ul>
            <li>
              <strong>GRV, fill, NTG</strong> — <Link to="/nrv">NRV / GRV</Link> → GRV × fill × NTG
            </li>
            <li>
              <strong>PORO, Sw, Bo</strong> — <Link to="/hc-yield">HC Yield</Link>
            </li>
          </ul>
        ) : (
          <ul>
            <li>
              <strong>Depth / area, Pinchout / fill</strong> — <Link to="/area">Area</Link>
            </li>
            <li>
              <strong>OWC / net pay</strong> — <Link to="/net-pay">Net Pay</Link>
            </li>
            <li>
              <strong>PORO, Sw, Bo</strong> — <Link to="/hc-yield">HC Yield</Link>
            </li>
          </ul>
        )}
      </div>
    </div>
  )
}
