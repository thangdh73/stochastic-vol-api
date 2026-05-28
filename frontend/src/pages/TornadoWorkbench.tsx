import { Link } from 'react-router-dom'
import { PerturbationTornadoChart } from '../components/charts/PerturbationTornadoChart'
import { WorkflowGate } from '../components/WorkflowGate'
import { useWorkflow } from '../context/WorkflowContext'

export function TornadoWorkbenchPage() {
  const { input } = useWorkflow()

  return (
    <div>
      <h1 className="page-title">Tornado</h1>
      <p className="page-desc">
        Workbook-style OAT tornado controls with scope filtering and grouped dependency support.
      </p>

      <WorkflowGate>
        <div className="card classic-toolbar">
          <div className="classic-toolbar-row">
            <strong>Tornado controls</strong>
            <Link to="/charts">Open full Charts page</Link>
            <Link to="/simulation">Run simulation</Link>
          </div>
        </div>
        {input ? (
          <div className="card">
            <PerturbationTornadoChart input={input} />
          </div>
        ) : (
          <div className="alert info">
            <Link to="/setup">Set up a project</Link> before opening tornado controls.
          </div>
        )}
      </WorkflowGate>
    </div>
  )
}
