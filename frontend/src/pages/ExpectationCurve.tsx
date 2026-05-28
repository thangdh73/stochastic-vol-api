import { Link } from 'react-router-dom'
import { ResourceCharts } from '../components/charts/ResourceCharts'
import { WorkflowGate } from '../components/WorkflowGate'
import { useWorkflow } from '../context/WorkflowContext'

export function ExpectationCurvePage() {
  const { simulation } = useWorkflow()
  const arrays = simulation?.result.arrays
  const hasArrays = arrays && Object.keys(arrays).length > 0

  return (
    <div>
      <h1 className="page-title">Expectation Curve</h1>
      <p className="page-desc">
        Exceedance and percentile plots from simulation arrays (reference-style expectation curve tab).
      </p>
      <WorkflowGate>
        <div className="card classic-toolbar">
          <div className="classic-toolbar-row">
            <strong>Plot controls</strong>
            <Link to="/simulation">Run simulation</Link>
            <Link to="/charts">Open full chart suite</Link>
          </div>
        </div>
        {!simulation && (
          <div className="alert info">
            <Link to="/simulation">Run a simulation</Link> to populate expectation curves.
          </div>
        )}
        {simulation && !hasArrays && (
          <div className="alert warn">Simulation has no arrays. Re-run simulation to generate curve data.</div>
        )}
        {simulation && hasArrays && arrays && (
          <div className="card">
            <ResourceCharts
              arrays={arrays}
              summaries={{
                total_mmboe: simulation.result.total_mmboe,
                recoverable_oil: simulation.result.recoverable_oil,
                stoiip: simulation.result.stoiip,
                solution_gas: simulation.result.solution_gas,
                giip: simulation.result.giip,
                recoverable_gas: simulation.result.recoverable_gas,
                condensate: simulation.result.condensate,
              }}
            />
          </div>
        )}
      </WorkflowGate>
    </div>
  )
}
