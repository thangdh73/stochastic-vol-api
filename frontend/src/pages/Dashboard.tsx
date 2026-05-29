import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useWorkflow } from '../context/WorkflowContext'
import { createDefaultInput } from '../utils/defaultInput'
import {
  ESTIMATING_METHOD_SHORT,
  effectiveEstimatingMethod,
} from '../utils/estimatingMethod'
import { computeModuleStatuses, moduleStatusLabel } from '../utils/moduleStatus'
import { useSaveProject } from '../context/SaveProjectContext'
import { ProjectSaveBar } from '../components/ProjectSaveBar'
import { ProjectFileActions } from '../components/ProjectFileActions'
import { SavedProjectsCard } from '../components/SavedProjectsCard'

export function Dashboard() {
  const {
    input,
    validation,
    simulation,
    activeProjectId,
    activeProjectName,
    setSegmentsFromInput,
    segments,
    reservoirs,
    setValidation,
    setSimulation,
    setActiveProject,
    clearModulePreviews,
    setError,
    loading,
    error,
  } = useWorkflow()

  const { saveOk, setSaveOk, setProjectName, resetSaved } = useSaveProject()
  const moduleStatus = computeModuleStatuses(input, validation, Boolean(simulation))

  const health = useQuery({ queryKey: ['health'], queryFn: api.health })

  const startNewProspect = () => {
    const fresh = createDefaultInput()
    setSegmentsFromInput(fresh)
    setValidation(null)
    setSimulation(null)
    clearModulePreviews()
    setActiveProject(null)
    setProjectName(fresh.prospect_name)
    resetSaved()
    setSaveOk(null)
    setError(null)
  }

  return (
    <div>
      <h1 className="page-title">Projects</h1>

      {error && <div className="alert error">{error}</div>}
      {saveOk && <div className="alert ok">{saveOk}</div>}

      {health.isError && (
        <div className="alert error">
          Cannot connect to the calculation service. Start the application or contact your
          administrator.
        </div>
      )}

      <SavedProjectsCard
        onLoaded={(msg) => {
          setError(null)
          setSaveOk(msg)
        }}
        onError={(msg) => {
          setSaveOk(null)
          setError(msg || null)
        }}
      />

      <ProjectFileActions
        onImported={(msg) => {
          setError(null)
          setSaveOk(msg)
        }}
        onExported={(msg) => {
          setError(null)
          setSaveOk(msg)
        }}
        onError={(msg) => {
          setSaveOk(null)
          setError(msg || null)
        }}
      />

      <div className="card">
        <h2>Current session</h2>
        {!input ? (
          <div className="btn-row">
            <button
              type="button"
              className="primary"
              onClick={startNewProspect}
              disabled={loading}
            >
              New prospect
            </button>
          </div>
        ) : (
          <>
            <dl className="meta-grid">
              <div>
                <dt>Prospect</dt>
                <dd>{input.prospect_name}</dd>
              </div>
              <div>
                <dt>Method</dt>
                <dd>{ESTIMATING_METHOD_SHORT[effectiveEstimatingMethod(input)]}</dd>
              </div>
              <div>
                <dt>Saved project</dt>
                <dd>
                  {activeProjectId != null ? (activeProjectName ?? '—') : 'Not saved'}
                </dd>
              </div>
              <div>
                <dt>Validation</dt>
                <dd>
                  {validation == null
                    ? 'Not run'
                    : validation.has_errors
                      ? 'Errors'
                      : 'OK'}
                </dd>
              </div>
              <div>
                <dt>Simulation</dt>
                <dd>{simulation ? 'Complete' : 'None'}</dd>
              </div>
              <div>
                <dt>Tanks</dt>
                <dd>{Math.max(1, segments.length) * Math.max(1, reservoirs.length)}</dd>
              </div>
            </dl>

            <ProjectSaveBar variant="compact" />

            <div className="btn-row" style={{ marginTop: '0.75rem' }}>
              <button type="button" onClick={startNewProspect} disabled={loading}>
                New prospect
              </button>
              <Link to="/setup/overview">
                <button type="button">Setup</button>
              </Link>
            </div>
          </>
        )}
      </div>

      {input && (
        <div className="card">
          <h2>Progress</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Setup</td>
                <td>{moduleStatusLabel(moduleStatus.prospect)}</td>
              </tr>
              {effectiveEstimatingMethod(input) === 'nrv_grv_yield' ? (
                <tr>
                  <td>Rock volume</td>
                  <td>{moduleStatusLabel(moduleStatus.nrv)}</td>
                </tr>
              ) : (
                <>
                  <tr>
                    <td>Area</td>
                    <td>{moduleStatusLabel(moduleStatus.area)}</td>
                  </tr>
                  <tr>
                    <td>Net Pay</td>
                    <td>{moduleStatusLabel(moduleStatus.net_pay)}</td>
                  </tr>
                </>
              )}
              <tr>
                <td>HC yield</td>
                <td>{moduleStatusLabel(moduleStatus.hc_yield)}</td>
              </tr>
              <tr>
                <td>Chance</td>
                <td>{moduleStatusLabel(moduleStatus.chance)}</td>
              </tr>
              <tr>
                <td>Dependencies</td>
                <td>{moduleStatusLabel(moduleStatus.correlations)}</td>
              </tr>
              <tr>
                <td>Simulation</td>
                <td>{moduleStatusLabel(moduleStatus.simulation)}</td>
              </tr>
              <tr>
                <td>Results</td>
                <td>{moduleStatusLabel(moduleStatus.results)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
