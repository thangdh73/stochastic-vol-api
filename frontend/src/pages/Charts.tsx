import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChartScopeFilter } from '../components/charts/ChartScopeFilter'
import { InputQcCharts } from '../components/charts/InputQcCharts'
import { PerturbationTornadoChart } from '../components/charts/PerturbationTornadoChart'
import { ResourceCharts } from '../components/charts/ResourceCharts'
import { ScatterCharts } from '../components/charts/ScatterCharts'
import { TornadoChart } from '../components/charts/TornadoChart'
import { useChartScope } from '../hooks/useChartScope'
import { useWorkflow } from '../context/WorkflowContext'
import { breakdownHasScopeArrays, scopeHasDedicatedArrays } from '../utils/chartScope'

type TornadoMode = 'spearman' | 'oat'

export function ChartsPage() {
  const { input, simulation, segments, reservoirs } = useWorkflow()
  const { options, selection, setSelection, resolved } = useChartScope(
    simulation,
    segments,
    reservoirs,
  )
  const [tornadoMode, setTornadoMode] = useState<TornadoMode>('spearman')
  const arrays = resolved?.arrays ?? simulation?.result.arrays
  const hasArrays = arrays && Object.keys(arrays).length > 0
  const multiTank = Boolean(simulation?.multi_tank?.enabled)
  const needsScopeRerun = multiTank && hasArrays && !breakdownHasScopeArrays(simulation)
  const scopeUsesFallback =
    selection.scopeType !== 'prospect' &&
    hasArrays &&
    !scopeHasDedicatedArrays(simulation, selection)

  return (
    <div>
      <h1 className="page-title">Charts</h1>

      {!input && (
        <div className="alert info">
          <Link to="/setup/overview">Set up a prospect</Link> to view charts.
        </div>
      )}

      {input && !simulation && (
        <div className="alert info">
          <Link to="/output/simulation">Run a simulation</Link> for histogram and Spearman tornado.
        </div>
      )}

      {simulation && !hasArrays && (
        <div className="alert warn">Re-run simulation to generate chart data.</div>
      )}

      {simulation && needsScopeRerun && (
        <div className="alert warn">
          Re-run simulation to enable per-tank and per-reservoir charts.
        </div>
      )}

      {simulation && scopeUsesFallback && (
        <div className="alert warn">No data for the selected scope — showing prospect total.</div>
      )}

      {input && (
        <>
          {simulation && hasArrays && (
            <>
              <div className="card">
                <h2>Scope</h2>
                <ChartScopeFilter
                  selection={selection}
                  options={options}
                  onChange={setSelection}
                />
              </div>

              <div className="card">
                <h2>Resource outputs</h2>
                {resolved && arrays && (
                  <ResourceCharts
                    arrays={arrays}
                    summaries={resolved.summaries}
                    scopeLabel={resolved.scopeLabel}
                  />
                )}
              </div>

              <div className="card">
                <h2>Input QC</h2>
                <InputQcCharts arrays={arrays} />
              </div>

              <div className="card">
                <h2>Scatter plots</h2>
                <ScatterCharts arrays={arrays} />
              </div>
            </>
          )}

          <div className="card">
            <h2>Tornado</h2>
            {!hasArrays && (
              <ChartScopeFilter
                selection={selection}
                options={options}
                onChange={setSelection}
              />
            )}
            <div className="chart-select-row" style={{ marginBottom: '0.75rem' }}>
              <label className="toggle-row">
                <input
                  type="radio"
                  name="tornadoMode"
                  checked={tornadoMode === 'spearman'}
                  onChange={() => setTornadoMode('spearman')}
                />
                Spearman (MC)
              </label>
              <label className="toggle-row" style={{ marginLeft: '1rem' }}>
                <input
                  type="radio"
                  name="tornadoMode"
                  checked={tornadoMode === 'oat'}
                  onChange={() => setTornadoMode('oat')}
                />
                OAT (P10/P90)
              </label>
            </div>
            {tornadoMode === 'spearman' ? (
              hasArrays ? (
                <TornadoChart
                  arrays={arrays!}
                  groupDriverMap={simulation?.group_driver_map}
                  scopeLabel={resolved?.scopeLabel}
                />
              ) : (
                <p className="convention-inline">
                  Run simulation first, or switch to <strong>OAT (P10/P90)</strong>.
                </p>
              )
            ) : (
              <PerturbationTornadoChart
                input={input}
                scopeSelection={selection}
                onScopeChange={setSelection}
                showScopeFilter={false}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
