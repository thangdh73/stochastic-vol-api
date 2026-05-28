import { Link } from 'react-router-dom'
import { useWorkflow } from '../context/WorkflowContext'
import { createDefaultInput } from '../utils/defaultInput'

interface WorkflowGateProps {
  children: React.ReactNode
}

export function WorkflowGate({ children }: WorkflowGateProps) {
  const {
    input,
    setSegmentsFromInput,
    setValidation,
    setSimulation,
    clearModulePreviews,
    setActiveProject,
    setError,
  } = useWorkflow()

  const startNew = () => {
    const fresh = createDefaultInput()
    setSegmentsFromInput(fresh)
    setValidation(null)
    setSimulation(null)
    clearModulePreviews()
    setActiveProject(null)
    setError(null)
  }

  if (!input) {
    return (
      <div className="card">
        <h2>No prospect loaded</h2>
        <p className="convention-inline">
          Start from the <Link to="/">Dashboard</Link>: click <strong>New prospect</strong>,
          then <strong>Save project</strong> when you are ready.
        </p>
        <div className="btn-row">
          <button type="button" className="primary" onClick={startNew}>
            New prospect
          </button>
          <Link to="/">
            <button type="button">← Dashboard</button>
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
