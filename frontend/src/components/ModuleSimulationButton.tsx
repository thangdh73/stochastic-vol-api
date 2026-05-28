import { api } from '../api/client'
import { formatApiError } from '../api/errors'
import { useWorkflow } from '../context/WorkflowContext'
import type { ModuleScope, ValidationReport } from '../types/api'

const SCOPE_LABELS: Record<ModuleScope, string> = {
  area: 'Area',
  net_pay: 'Net Pay',
  hc_yield: 'HC Yield',
  chance: 'Chance',
  nrv: 'NRV',
}

interface ModuleSimulationButtonProps {
  scope: ModuleScope
  className?: string
}

/**
 * Tab-scoped Monte Carlo preview — stays on the current page and updates
 * only that module's charts / summaries (not full-case Results).
 */
export function ModuleSimulationButton({
  scope,
  className = 'primary',
}: ModuleSimulationButtonProps) {
  const { input, loading, setValidation, setModulePreview, setLoading, setError } =
    useWorkflow()

  if (!input) return null

  const label = SCOPE_LABELS[scope]

  const runPreview = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.simulateModulePreview(input, scope)
      setValidation(result.validation)
      if (result.validation.has_errors) {
        setError(`${label} simulation blocked: fix QA/QC errors for this tab.`)
        return
      }
      setModulePreview(scope, result)
    } catch (e) {
      try {
        const parsed = JSON.parse(e instanceof Error ? e.message : String(e)) as {
          detail?: { validation?: ValidationReport }
        }
        if (parsed.detail?.validation) setValidation(parsed.detail.validation)
      } catch {
        /* ignore */
      }
      setError(formatApiError(e, `${label} simulation`))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={runPreview}
      disabled={loading}
      title={`Sample ${label} inputs only (${input.n_iterations.toLocaleString()} iterations)`}
    >
      Run {label} simulation
    </button>
  )
}
