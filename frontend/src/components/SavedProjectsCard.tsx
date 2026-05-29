import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useWorkflow } from '../context/WorkflowContext'
import { useSaveProject } from '../context/SaveProjectContext'
import { envelopeFromMetadata } from '../utils/tankEnvelope'
import { formatApiError } from '../api/errors'
import type { Prospect } from '../types/api'

type SavedProjectsCardProps = {
  onLoaded?: (message: string) => void
  onError?: (message: string) => void
}

export function SavedProjectsCard({ onLoaded, onError }: SavedProjectsCardProps) {
  const queryClient = useQueryClient()
  const {
    activeProjectId,
    activeProjectName,
    loadFromEnvelope,
    setSegmentsFromInput,
    setActiveProject,
    setValidation,
    setSimulation,
    clearModulePreviews,
    setLoading,
    loading,
  } = useWorkflow()
  const { setProjectName, markSaved } = useSaveProject()

  const prospects = useQuery({ queryKey: ['prospects'], queryFn: api.listProspects })
  const [selectedId, setSelectedId] = useState<number | null>(activeProjectId)

  useEffect(() => {
    if (activeProjectId != null) setSelectedId(activeProjectId)
  }, [activeProjectId])

  const selectedProspect = prospects.data?.find((p) => p.id === selectedId) ?? null
  const isSelectedInSession = selectedId != null && selectedId === activeProjectId

  const loadProject = async (prospect: Prospect) => {
    setLoading(true)
    try {
      const full = await api.getProspect(prospect.id)
      const savedEnvelope = envelopeFromMetadata(full.metadata)
      if (savedEnvelope) {
        loadFromEnvelope(savedEnvelope)
      } else {
        const data = await api.loadLatestProjectInput(prospect.id)
        setSegmentsFromInput(data)
      }
      setValidation(null)
      setSimulation(null)
      clearModulePreviews()
      setActiveProject(prospect.id, prospect.name)
      setProjectName(prospect.name)
      setSelectedId(prospect.id)
      markSaved()
      onLoaded?.(`Loaded “${prospect.name}”.`)
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }

  const deleteProject = async (prospect: Prospect) => {
    if (loading) return
    const ok = window.confirm(
      `Delete saved project “${prospect.name}”? This removes all input sets and simulation runs.`,
    )
    if (!ok) return
    setLoading(true)
    try {
      await api.deleteProspect(prospect.id)
      await queryClient.invalidateQueries({ queryKey: ['prospects'] })
      if (selectedId === prospect.id) setSelectedId(null)
      if (activeProjectId === prospect.id) {
        setActiveProject(null)
        onLoaded?.(`Deleted “${prospect.name}”. Your current session data is still in memory (not linked to DB).`)
      } else {
        onLoaded?.(`Deleted “${prospect.name}”.`)
      }
    } catch (e) {
      onError?.(formatApiError(e, 'Delete project'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card saved-projects-card">
      <div className="card-header-row">
        <h2 style={{ margin: 0 }}>Saved projects</h2>
        <button
          type="button"
          className="btn-secondary"
          disabled={prospects.isFetching}
          onClick={() => void prospects.refetch()}
        >
          Refresh list
        </button>
      </div>
      <p className="convention-inline">
        Double-click a row to load. Use <strong>Save</strong> to store changes.
      </p>

      {prospects.isLoading && <p>Loading…</p>}
      {prospects.isError && (
        <p className="alert warn">Could not load projects — check that the API is running.</p>
      )}
      {prospects.data && prospects.data.length === 0 && (
        <p className="alert info">
          No saved projects yet. Start with <strong>New prospect</strong>, enter a name, and click{' '}
          <strong>Save</strong>.
        </p>
      )}

      {prospects.data && prospects.data.length > 0 && (
        <>
          <div className="saved-projects-toolbar">
            <button
              type="button"
              className="primary"
              disabled={loading || selectedProspect == null || isSelectedInSession}
              onClick={() => selectedProspect && void loadProject(selectedProspect)}
            >
              {loading ? 'Loading…' : 'Load project'}
            </button>
            {selectedProspect && isSelectedInSession && (
              <span className="saved-projects-hint muted">
                “{activeProjectName ?? selectedProspect.name}” is already loaded in this session.
              </span>
            )}
            {selectedProspect && !isSelectedInSession && (
              <span className="saved-projects-hint muted">
                Selected: <strong>{selectedProspect.name}</strong>
              </span>
            )}
          </div>

          <div className="saved-projects-table-wrap">
            <table className="data-table saved-projects-table">
              <thead>
                <tr>
                  <th aria-label="Select" />
                  <th>Project</th>
                  <th>Input sets</th>
                  <th>Sim runs</th>
                  <th>Last saved</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {prospects.data.map((p) => {
                  const selected = selectedId === p.id
                  const inSession = activeProjectId === p.id
                  return (
                    <tr
                      key={p.id}
                      className={[
                        'saved-project-row',
                        selected ? 'saved-project-row--selected' : '',
                        inSession ? 'saved-project-row--active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => setSelectedId(p.id)}
                      onDoubleClick={() => void loadProject(p)}
                    >
                      <td>
                        <input
                          type="radio"
                          name="saved-project-pick"
                          checked={selected}
                          onChange={() => setSelectedId(p.id)}
                          aria-label={`Select ${p.name}`}
                        />
                      </td>
                      <td>
                        <strong>{p.name}</strong>
                        {inSession && (
                          <span className="saved-project-badge">In session</span>
                        )}
                      </td>
                      <td>{p.input_set_count ?? 0}</td>
                      <td>{p.simulation_run_count ?? 0}</td>
                      <td>{new Date(p.updated_at).toLocaleString()}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={loading}
                          onClick={() => void loadProject(p)}
                        >
                          Load
                        </button>{' '}
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={loading}
                          onClick={() => void deleteProject(p)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
