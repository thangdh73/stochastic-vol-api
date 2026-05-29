import { Link } from 'react-router-dom'
import { PerturbationTornadoChart } from '../components/charts/PerturbationTornadoChart'
import { WorkflowGate } from '../components/WorkflowGate'
import { useWorkflow } from '../context/WorkflowContext'

export function TornadoWorkbenchPage() {
  const { input } = useWorkflow()

  return (
    <div>
      <h1 className="page-title">Tornado</h1>
      <WorkflowGate>
        {input ? (
          <div className="card">
            <PerturbationTornadoChart input={input} />
          </div>
        ) : (
          <div className="alert info">
            Set up a project on the <Link to="/setup/overview">Setup</Link> page first.
          </div>
        )}
      </WorkflowGate>
    </div>
  )
}
