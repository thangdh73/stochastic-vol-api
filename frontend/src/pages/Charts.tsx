import { LEGACY_WORKBOOK_LABEL } from '../constants/appBranding'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { InputQcCharts } from '../components/charts/InputQcCharts'
import { PerturbationTornadoChart } from '../components/charts/PerturbationTornadoChart'
import { ResourceCharts } from '../components/charts/ResourceCharts'
import { ScatterCharts } from '../components/charts/ScatterCharts'
import { TornadoChart } from '../components/charts/TornadoChart'
import { useWorkflow } from '../context/WorkflowContext'

const WORKBOOK_CHARTS = [
  'Resource / EUR histogram & exceedance (P99–P01)',
  'Area, Net Pay, NRV, Productive Area percentile curves',
  'Oil / gas yield scatter & key points',
  'Scatter Chart — cross-variable relationships',
  'Scenario comparison bars (phase 2)',
  'Tornado — Spearman (MC) and workbook OAT (P10/P90)',
]

const WEB_CHARTS = [
  'Resource histogram, exceedance, percentile profile & bar',
  'Input distribution QC histograms',
  'Configurable scatter + workbook presets',
  'Tornado — Spearman ρ (Monte Carlo arrays)',
  'Tornado — workbook OAT at input P50 / P90 / P10',
]

type TornadoMode = 'spearman' | 'oat'

export function ChartsPage() {
  const { input, simulation } = useWorkflow()
  const [tornadoMode, setTornadoMode] = useState<TornadoMode>('spearman')
  const arrays = simulation?.result.arrays
  const hasArrays = arrays && Object.keys(arrays).length > 0

  return (
    <div>
      <h1 className="page-title">Charts &amp; QC plots</h1>
      <p className="page-desc">
        Uncertainty plots aligned with the {LEGACY_WORKBOOK_LABEL} (Resources, Scatter Chart, HC Yield).
        Histograms and Spearman tornado need a simulation with iteration arrays; workbook
        OAT tornado uses current project inputs only.
      </p>

      {!input && (
        <div className="alert info">
          <Link to="/prospect">Set up a prospect</Link> to view charts.
        </div>
      )}

      {input && !simulation && (
        <div className="alert info">
          <Link to="/simulation">Run a simulation</Link> for histograms and Spearman tornado.
          Workbook OAT tornado is available below from current inputs.
        </div>
      )}

      {simulation && !hasArrays && (
        <div className="alert warn">
          This result has no sample arrays. Re-run simulation from the Simulation page
          (arrays are included automatically) for Spearman tornado and histograms.
        </div>
      )}

      {input && (
        <>
          {simulation && hasArrays && (
            <>
              <div className="card chart-legend-card">
                <h2>Reference workbook vs this build</h2>
                <div className="chart-legend-grid">
                  <div>
                    <h3>Workbook (~31 charts)</h3>
                    <ul className="chart-legend-list">
                      {WORKBOOK_CHARTS.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3>Web (implemented)</h3>
                    <ul className="chart-legend-list implemented">
                      {WEB_CHARTS.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="convention-inline">
                  Convention: {simulation.result.percentile_convention}. Seed{' '}
                  {simulation.result.seed}, n={simulation.result.n_iterations}.
                </p>
              </div>

              <div className="card">
                <h2>Resource outputs</h2>
                <ResourceCharts
                  arrays={arrays}
                  summaries={{
                    total_mmboe: simulation.result.total_mmboe,
                    recoverable_oil: simulation.result.recoverable_oil,
                    stoiip: simulation.result.stoiip,
                    solution_gas: simulation.result.solution_gas,
                    recoverable_gas: simulation.result.recoverable_gas,
                    giip: simulation.result.giip,
                    condensate: simulation.result.condensate,
                  }}
                />
              </div>

              <div className="card">
                <h2>Input QC — sampled distributions</h2>
                <InputQcCharts arrays={arrays} />
              </div>

              <div className="card">
                <h2>Scatter / cross-plots</h2>
                <ScatterCharts arrays={arrays} />
              </div>
            </>
          )}

          <div className="card">
            <h2>Tornado — sensitivity drivers</h2>
            <div className="chart-select-row" style={{ marginBottom: '0.75rem' }}>
              <label className="toggle-row">
                <input
                  type="radio"
                  name="tornadoMode"
                  checked={tornadoMode === 'spearman'}
                  onChange={() => setTornadoMode('spearman')}
                />
                Spearman (MC correlation)
              </label>
              <label className="toggle-row" style={{ marginLeft: '1rem' }}>
                <input
                  type="radio"
                  name="tornadoMode"
                  checked={tornadoMode === 'oat'}
                  onChange={() => setTornadoMode('oat')}
                />
                Workbook OAT (P10/P90)
              </label>
            </div>
            {tornadoMode === 'spearman' ? (
              hasArrays ? (
                <TornadoChart arrays={arrays!} groupDriverMap={simulation?.group_driver_map} />
              ) : (
                <p className="convention-inline">
                  Run simulation with arrays to use Spearman tornado, or switch to{' '}
                  <strong>Workbook OAT</strong>.
                </p>
              )
            ) : (
              <PerturbationTornadoChart input={input} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
