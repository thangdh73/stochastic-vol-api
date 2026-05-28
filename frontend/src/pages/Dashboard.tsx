import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useWorkflow } from '../context/WorkflowContext'
import { createDefaultInput } from '../utils/defaultInput'
import {
  ESTIMATING_METHOD_SHORT,
  effectiveEstimatingMethod,
} from '../utils/estimatingMethod'
import { computeModuleStatuses, moduleStatusLabel } from '../utils/moduleStatus'
import { formatApiError } from '../api/errors'
import { TANK_ENVELOPE_META_KEY, envelopeFromMetadata } from '../utils/tankEnvelope'
import { buildQaFullDummyEnvelope } from '../utils/qaFullDummyCase'

export function Dashboard() {
  const queryClient = useQueryClient()
  const {
    input,
    validation,
    simulation,
    activeProjectId,
    activeProjectName,
    setInput,
    setSegmentsFromInput,
    getEnvelopeForSave,
    loadFromEnvelope,
    reservoirs,
    segments,
    setValidation,
    setSimulation,
    setActiveProject,
    clearModulePreviews,
    setLoading,
    setError,
    loading,
    error,
  } = useWorkflow()

  const [projectName, setProjectName] = useState('')
  const [saveOk, setSaveOk] = useState<string | null>(null)
  const moduleStatus = computeModuleStatuses(input, validation, Boolean(simulation))

  const health = useQuery({ queryKey: ['health'], queryFn: api.health })
  const prospects = useQuery({ queryKey: ['prospects'], queryFn: api.listProspects })

  useEffect(() => {
    if (!input) return
    setProjectName(activeProjectName ?? input.prospect_name ?? 'New Prospect')
  }, [input, activeProjectName])

  const startNewProspect = () => {
    const fresh = createDefaultInput()
    setSegmentsFromInput(fresh)
    setValidation(null)
    setSimulation(null)
    clearModulePreviews()
    setActiveProject(null)
    setProjectName(fresh.prospect_name)
    setSaveOk(null)
    setError(null)
  }

  const loadQaFullDummy = async () => {
    setLoading(true)
    setError(null)
    setSaveOk(null)
    try {
      const envelope = await buildQaFullDummyEnvelope()
      loadFromEnvelope(envelope)
      setValidation(null)
      setSimulation(null)
      clearModulePreviews()
      setActiveProject(null)
      setProjectName('QA Full Dummy')
      setSaveOk(
        `Loaded QA dummy: ${envelope.segments.length} segments × ${envelope.reservoirs.length} reservoirs (${envelope.segments.length * envelope.reservoirs.length} tanks), 5 uncertainty groups. Save project to persist.`,
      )
    } catch (e) {
      setError(formatApiError(e, 'Load QA dummy'))
    } finally {
      setLoading(false)
    }
  }

  const saveProject = async () => {
    if (!input) return
    const name = projectName.trim() || input.prospect_name || 'Untitled prospect'
    setLoading(true)
    setError(null)
    setSaveOk(null)
    try {
      let prospectId = activeProjectId
      const envelope = getEnvelopeForSave()
      const meta: Record<string, unknown> = {
        basin: input.basin ?? '',
        formation: input.formation ?? '',
        country: input.country ?? '',
        estimating_method: input.estimating_method ?? 'area_net_pay_yield',
      }
      if (envelope) meta[TANK_ENVELOPE_META_KEY] = envelope
      if (prospectId == null) {
        const created = await api.createProspect(name, meta)
        prospectId = created.id
      } else {
        await api.updateProspect(prospectId, { name, metadata: meta })
      }
      const syncedInput = { ...input, prospect_name: name }
      setInput(syncedInput)
      const saved = await api.saveInputSet(prospectId, syncedInput)
      setActiveProject(prospectId, name)
      const isUpdate = activeProjectId != null
      const tankNote =
        envelope && envelope.segments.length * envelope.reservoirs.length > 1
          ? ` All ${envelope.segments.length * envelope.reservoirs.length} tanks saved.`
          : ''
      setSaveOk(
        isUpdate
          ? `Updated project “${name}” (input set #${saved.id}; latest version is used on Open).${tankNote}`
          : `Created project “${name}” (input set #${saved.id}).${tankNote}`,
      )
      await queryClient.invalidateQueries({ queryKey: ['prospects'] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  const loadProject = async (prospectId: number, name: string) => {
    setLoading(true)
    setError(null)
    setSaveOk(null)
    try {
      const prospect = await api.getProspect(prospectId)
      const savedEnvelope = envelopeFromMetadata(prospect.metadata)
      if (savedEnvelope) {
        loadFromEnvelope(savedEnvelope)
      } else {
        const data = await api.loadLatestProjectInput(prospectId)
        setSegmentsFromInput(data)
      }
      setValidation(null)
      setSimulation(null)
      clearModulePreviews()
      setActiveProject(prospectId, name)
      setProjectName(name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }

  const deleteProject = async (prospectId: number, name: string) => {
    if (loading) return
    const ok = window.confirm(
      `Delete saved project “${name}”? This will remove all saved input sets and simulation runs for this project.`,
    )
    if (!ok) return
    setLoading(true)
    setError(null)
    setSaveOk(null)
    try {
      await api.deleteProspect(prospectId)
      await queryClient.invalidateQueries({ queryKey: ['prospects'] })
      if (activeProjectId === prospectId) {
        // Keep the in-session inputs, but remove the DB link.
        setActiveProject(null)
        setSaveOk(`Deleted project “${name}”. Session inputs are still loaded (not saved).`)
      } else {
        setSaveOk(`Deleted project “${name}”.`)
      }
    } catch (e) {
      setError(formatApiError(e, 'Delete project'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-desc">
        Start a prospect, save your work, and open the volumetric workflow.
      </p>

      {error && <div className="alert error">{error}</div>}
      {saveOk && <div className="alert ok">{saveOk}</div>}

      <div className="card">
        <h2>API status</h2>
        {health.isLoading && <p>Checking backend…</p>}
        {health.isError && (
          <div className="alert error">
            Backend unavailable. Start the API:{' '}
            <code>uvicorn app.main:app --reload --port 8001</code> from{' '}
            <code>backend/</code>
          </div>
        )}
        {health.data?.engine_version && (
          <div className="alert ok">
            Connected — engine {health.data.engine_version}, schema{' '}
            {health.data.schema_version}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Project</h2>
        {!input ? (
          <>
            <p className="convention-inline">
              Create a new prospect to begin. All inputs are edited on the workflow tabs
              (Prospect Setup, Area or NRV / GRV, HC Yield, Chance).
            </p>
            <div className="btn-row">
              <button
                type="button"
                className="primary"
                onClick={startNewProspect}
                disabled={loading}
              >
                New prospect
              </button>
              <button type="button" onClick={loadQaFullDummy} disabled={loading}>
                Load QA full dummy
              </button>
            </div>
          </>
        ) : (
          <>
            <dl className="meta-grid">
              <div>
                <dt>Session prospect</dt>
                <dd>{input.prospect_name}</dd>
              </div>
              <div>
                <dt>Estimating method</dt>
                <dd>{ESTIMATING_METHOD_SHORT[effectiveEstimatingMethod(input)]}</dd>
              </div>
              <div>
                <dt>Saved as project</dt>
                <dd>
                  {activeProjectId != null
                    ? `${activeProjectName ?? '—'} (id ${activeProjectId})`
                    : 'Not saved yet — use Save project below'}
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
                <dt>Last simulation</dt>
                <dd>{simulation ? 'Complete' : 'None'}</dd>
              </div>
              <div>
                <dt>Tank count</dt>
                <dd>{Math.max(1, segments.length) * Math.max(1, reservoirs.length)}</dd>
              </div>
            </dl>

            <label style={{ display: 'block', marginTop: '1rem' }}>
              Project name (for save)
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                style={{
                  display: 'block',
                  width: '100%',
                  maxWidth: 360,
                  marginTop: '0.35rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 6,
                  border: '1px solid #c5d0dc',
                }}
              />
            </label>

            <div className="btn-row" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="primary"
                onClick={saveProject}
                disabled={loading || !projectName.trim()}
              >
                Save project
              </button>
              <button type="button" onClick={startNewProspect} disabled={loading}>
                New prospect
              </button>
              <button type="button" onClick={loadQaFullDummy} disabled={loading}>
                Reload QA dummy
              </button>
              <Link to="/prospect">
                <button type="button">Edit inputs →</button>
              </Link>
            </div>
            <p className="convention-inline muted" style={{ marginTop: '0.75rem' }}>
              <strong>Save project</strong> writes the current tab data to the database.
              Same linked project + changed inputs → new version (Open loads the latest).
              <strong> New prospect</strong> clears the link so the next save creates a new
              project. Rename the project name field before save to relabel an existing
              project.
            </p>
          </>
        )}
      </div>

      {input && (
        <div className="card">
          <h2>Module completion</h2>
          <p className="convention-inline">
            Lightweight checklist based on required inputs + last QA/QC state (FRS NAV-003/DASH-002).
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Prospect Setup</td>
                <td>{moduleStatusLabel(moduleStatus.prospect)}</td>
              </tr>
              {effectiveEstimatingMethod(input) === 'nrv_grv_yield' ? (
                <tr>
                  <td>NRV / GRV</td>
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
                <td>HC Yield</td>
                <td>{moduleStatusLabel(moduleStatus.hc_yield)}</td>
              </tr>
              <tr>
                <td>Chance</td>
                <td>{moduleStatusLabel(moduleStatus.chance)}</td>
              </tr>
              <tr>
                <td>Correlations</td>
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

      <div className="card">
        <h2>Project file format (brainstorm)</h2>
        <p className="convention-inline">
          <strong>How save / load / update works</strong>
        </p>
        <ol>
          <li>
            <strong>New prospect</strong> — empty session; nothing in the database until you
            save.
          </li>
          <li>
            <strong>Save project</strong> — creates a <em>prospect</em> (folder) + an{' '}
            <em>input set</em> (full JSON snapshot). Edit Area, Chance, etc., then save
            again: same prospect, <em>new input set</em> if inputs changed (hash differs).
          </li>
          <li>
            <strong>Open</strong> (saved projects table) — loads the <em>latest</em> input
            set into the session; re-run validation/simulation as needed.
          </li>
          <li>
            <strong>Simulation → Save &amp; run</strong> — optional: saves inputs and stores
            Monte Carlo results linked to that input set.
          </li>
        </ol>
        <p className="convention-inline">
          <strong>Stored JSON</strong> (<code>schema_version: &quot;1&quot;</code>): all
          distributions, chance, correlations, estimating method, NRV/GRV fields, resource
          units, iterations, seed.
        </p>
        <p className="convention-inline">
          <strong>Future portable formats</strong> (not built yet — candidates):
        </p>
        <ul>
          <li>
            <code>.mmra.json</code> — single-file export/import of the input set (same JSON
            as above) for email or git.
          </li>
          <li>
            <code>.mmra.zip</code> — JSON + CSV results + notes/README for audit packs.
          </li>
          <li>
            Workbook round-trip — import/export aligned with reference Excel sheets (larger effort).
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>Saved projects</h2>
        {prospects.isLoading && <p>Loading…</p>}
        {prospects.isError && (
          <p className="alert warn">Could not load projects (API may be offline).</p>
        )}
        {prospects.data && prospects.data.length === 0 && (
          <p>No saved projects yet. Create a prospect and click <strong>Save project</strong>.</p>
        )}
        {prospects.data && prospects.data.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Input sets</th>
                <th>Sim runs</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {prospects.data.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.input_set_count ?? 0}</td>
                  <td>{p.simulation_run_count ?? 0}</td>
                  <td>{new Date(p.updated_at).toLocaleString()}</td>
                  <td>
                    <div className="btn-row" style={{ margin: 0 }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={loading}
                        onClick={() => loadProject(p.id, p.name)}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={loading}
                        onClick={() => deleteProject(p.id, p.name)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
