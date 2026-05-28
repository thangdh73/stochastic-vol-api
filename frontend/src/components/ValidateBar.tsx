import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { formatApiError } from '../api/errors'
import { useWorkflow } from '../context/WorkflowContext'

export function ValidateBar() {
  const { input, validation, setValidation, setLoading, loading, setError } = useWorkflow()

  if (!input) return null

  const runValidate = async () => {
    setLoading(true)
    setError(null)
    try {
      const report = await api.validate(input)
      setValidation(report)
    } catch (e) {
      setError(formatApiError(e, 'QA/QC'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="validate-bar card">
      <h3 className="validate-bar-title">QA/QC</h3>
      <div className="btn-row validate-bar-actions">
        <button type="button" onClick={runValidate} disabled={loading}>
          Run QA/QC
        </button>
        {validation && (
          <span
            className={`badge ${validation.has_errors ? 'error' : 'ok'}`}
            style={
              validation.has_errors
                ? undefined
                : { background: '#e8f5e9', color: '#2e5c32' }
            }
          >
            {validation.has_errors
              ? `${validation.issues.filter((i) => i.severity === 'ERROR').length} blocking error(s)`
              : 'QA/QC passed'}
          </span>
        )}
        <Link to="/qaqc">
          <button type="button">QA/QC detail</button>
        </Link>
        <Link to="/simulation">
          <button type="button">Simulation page</button>
        </Link>
      </div>
      {validation?.has_errors && (
        <p className="alert warn" style={{ margin: '0.5rem 0 0' }}>
          Fix errors before full-case simulation. Tab-scoped runs validate only that
          module&apos;s inputs.
        </p>
      )}
      {!validation && (
        <p className="convention-inline" style={{ margin: '0.5rem 0 0' }}>
          Run QA/QC for the full case. Use <strong>Run … simulation</strong> on each
          workflow tab for module previews; full Monte Carlo is on the{' '}
          <Link to="/simulation">Simulation</Link> page.
        </p>
      )}
    </div>
  )
}
