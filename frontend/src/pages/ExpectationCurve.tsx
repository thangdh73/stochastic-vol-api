import { Link } from 'react-router-dom'
import { ChartScopeFilter } from '../components/charts/ChartScopeFilter'
import { ResourceCharts } from '../components/charts/ResourceCharts'
import { WorkflowGate } from '../components/WorkflowGate'
import { useChartScope } from '../hooks/useChartScope'
import { useWorkflow } from '../context/WorkflowContext'
import { breakdownHasScopeArrays, scopeHasDedicatedArrays } from '../utils/chartScope'

export function ExpectationCurvePage() {
  const { simulation, segments, reservoirs } = useWorkflow()
  const { options, selection, setSelection, resolved } = useChartScope(
    simulation,
    segments,
    reservoirs,
  )
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
      <h1 className="page-title">Expectation Curve</h1>
      <WorkflowGate>
        {!simulation && (
          <div className="alert info">
            <Link to="/simulation">Run a simulation</Link> to populate expectation curves.
          </div>
        )}
        {simulation && !hasArrays && (
          <div className="alert warn">Re-run simulation to generate curve data.</div>
        )}
        {simulation && needsScopeRerun && (
          <div className="alert warn">Re-run simulation for per-tank curves.</div>
        )}
        {simulation && scopeUsesFallback && (
          <div className="alert warn">Showing prospect total for this scope.</div>
        )}
        {simulation && hasArrays && arrays && resolved && (
          <div className="card">
            <ChartScopeFilter
              selection={selection}
              options={options}
              onChange={setSelection}
            />
            <ResourceCharts
              arrays={arrays}
              summaries={resolved.summaries}
              scopeLabel={resolved.scopeLabel}
            />
          </div>
        )}
      </WorkflowGate>
    </div>
  )
}
