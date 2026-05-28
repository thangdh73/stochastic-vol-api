import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { formatApiError } from '../api/errors'
import { useWorkflow } from '../context/WorkflowContext'

interface RunSimulationButtonProps {
  /** Show link to full Simulation page */
  showSimulationLink?: boolean
  className?: string
}

/**
 * Primary Monte Carlo run — also available on the Simulation page.
 */
export function RunSimulationButton({
  showSimulationLink = false,
  className = 'primary',
}: RunSimulationButtonProps) {
  const navigate = useNavigate()
  const {
    input,
    validation,
    loading,
    setValidation,
    setSimulation,
    setLoading,
    setError,
    getGroupDependencyContext,
  } = useWorkflow()

  if (!input) return null

  const runSimulate = async () => {
    setLoading(true)
    setError(null)
    try {
      const report = await api.validate(input)
      setValidation(report)
      if (report.has_errors) {
        setError('Simulation blocked: fix validation errors first (see QA/QC).')
        return
      }
      const result = await api.simulate(input, true, getGroupDependencyContext() ?? undefined)
      setSimulation(result)
      navigate('/results')
    } catch (e) {
      setError(formatApiError(e, 'Simulation'))
    } finally {
      setLoading(false)
    }
  }

  const blocked = validation?.has_errors ?? false

  return (
    <span className="run-simulation-group">
      <button
        type="button"
        className={className}
        onClick={runSimulate}
        disabled={loading || blocked}
        title={
          blocked
            ? 'Fix QA/QC errors first'
            : 'Run Monte Carlo simulation (5,000 iterations)'
        }
      >
        Run simulation
      </button>
      {showSimulationLink && (
        <Link to="/simulation" className="run-simulation-link">
          Simulation page →
        </Link>
      )}
    </span>
  )
}
