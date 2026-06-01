import { Link } from 'react-router-dom'
import { PerturbationTornadoChart } from '../components/charts/PerturbationTornadoChart'
import { PetrelCumulativeTornadoPanel } from '../components/charts/PetrelCumulativeTornadoPanel'
import { WorkflowGate } from '../components/WorkflowGate'
import { useWorkflow } from '../context/WorkflowContext'

export function TornadoWorkbenchPage() {
  const { input, isPetrelCumulativeActive, petrelCumulativeResult } = useWorkflow()

  if (isPetrelCumulativeActive) {
    return (
      <div>
        <h1 className="page-title">Tornado</h1>
        <WorkflowGate>
          {petrelCumulativeResult ? (
            <PetrelCumulativeTornadoPanel />
          ) : (
            <div className="alert info">
              <Link to="/output/simulation">Run a Petrel cumulative simulation</Link> first,
              then the deterministic tornado appears here.
            </div>
          )}
        </WorkflowGate>
      </div>
    )
  }

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
