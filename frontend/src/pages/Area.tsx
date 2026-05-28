import { LEGACY_WORKBOOK_LABEL } from '../constants/appBranding'
import { Link } from 'react-router-dom'
import { AreaWorkbookCharts } from '../components/charts/AreaWorkbookCharts'
import { AreaDistributionForm } from '../components/AreaDistributionForm'
import { ComplexTrapsPanel } from '../components/ComplexTrapsPanel'
import { DistributionInputCard } from '../components/DistributionInputCard'
import { ModuleSimulationButton } from '../components/ModuleSimulationButton'
import { ModuleSummariesCard } from '../components/ModuleSummariesCard'
import { InputScopeBadge } from '../components/InputScopeBadge'
import { TankSelectorStrip } from '../components/TankSelectorStrip'
import { ValidateBar } from '../components/ValidateBar'
import { WorkflowGate } from '../components/WorkflowGate'
import { useWorkflow } from '../context/WorkflowContext'
import { updateDistribution } from '../utils/inputHelpers'
import { areaChartUnitFromInput } from '../utils/inputDisplayUnits'
import { areaInputUnitLabel } from '../constants/inputUnits'

export function AreaPage() {
  const { input, setInput, getModulePreview, error, setError } = useWorkflow()
  const displayUnit = areaChartUnitFromInput(input)

  const areaPreview = getModulePreview('area')
  const arrays = areaPreview?.arrays
  const hasAreaCharts = Boolean(
    arrays && (arrays.area?.length || arrays.productive_area?.length),
  )

  const trapCounts =
    areaPreview?.metadata?.complex_trap_scenario_counts as
      | Record<string, number>
      | undefined

  const chartUnitLabel = displayUnit === 'sq_km' ? 'sq km' : 'acres'

  return (
    <div>
      <h1 className="page-title">Area</h1>
      <p className="page-desc">
        Closed area, percent fill, and geometric correction. Charts follow the{' '}
        {LEGACY_WORKBOOK_LABEL}
        Productive Area views (cumulative probability and P99–P01 ranges). Use{' '}
        <strong>Run Area simulation</strong> on this tab only — full-case Monte Carlo
        is on the <Link to="/simulation">Simulation</Link> page.
      </p>

      {error && (
        <div className="alert error">
          {error}
          <button
            type="button"
            className="btn-secondary"
            style={{ marginLeft: '0.75rem' }}
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <WorkflowGate>
        <InputScopeBadge />
        <TankSelectorStrip />
        {input && (
          <>
            <div className="card">
              <h2>Area input unit</h2>
              <p className="convention-inline">
                Using <strong>{areaInputUnitLabel(input.area_input_unit)}</strong> from{' '}
                <Link to="/prospect">Prospect Setup → Units</Link>. The engine
                stores acres internally (1 sq km ≈ 247.1 acres).
              </p>
            </div>

            {input.area_dist && (
              <div className="card">
                <AreaDistributionForm
                  canonicalDist={input.area_dist}
                  displayUnit={displayUnit}
                  onCommit={(canonical) =>
                    setInput(updateDistribution(input, 'area_dist', canonical))
                  }
                />
              </div>
            )}
            {input.percent_fill_dist && (
              <div className="card">
                <DistributionInputCard
                  dist={input.percent_fill_dist}
                  onChange={(d) =>
                    setInput(updateDistribution(input, 'percent_fill_dist', d))
                  }
                  asPercent
                />
              </div>
            )}
            {input.geometric_correction_dist && (
              <div className="card">
                <DistributionInputCard
                  dist={input.geometric_correction_dist}
                  onChange={(d) =>
                    setInput(updateDistribution(input, 'geometric_correction_dist', d))
                  }
                  asPercent
                />
              </div>
            )}

            <div className="card">
              <ComplexTrapsPanel
                input={input}
                displayUnit={displayUnit}
                onChange={setInput}
              />
            </div>

            {trapCounts && Object.keys(trapCounts).length > 0 && (
              <div className="card">
                <h3>Last Area run — trap scenarios</h3>
                <ul className="chart-legend-list">
                  {Object.entries(trapCounts).map(([label, count]) => (
                    <li key={label}>
                      {label}: {count.toLocaleString()} iterations
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="card">
              <div className="card-header-row">
                <h2>Productive Area — QC charts ({chartUnitLabel})</h2>
                <div className="btn-row" style={{ margin: 0 }}>
                  <ModuleSimulationButton scope="area" className="primary" />
                </div>
              </div>
              {!hasAreaCharts ? (
                <p className="alert info">
                  Click <strong>Run Area simulation</strong> to sample closed area,
                  percent fill, GCF, and complex traps for charts on this tab only.
                </p>
              ) : (
                <>
                  {areaPreview && <ModuleSummariesCard preview={areaPreview} />}
                  <AreaWorkbookCharts arrays={arrays!} displayUnit={displayUnit} />
                </>
              )}
            </div>

            <ValidateBar />

            <div className="btn-row">
              <Link to="/net-pay">
                <button type="button" className="primary">
                  Next: Net Pay →
                </button>
              </Link>
            </div>
          </>
        )}
      </WorkflowGate>
    </div>
  )
}
