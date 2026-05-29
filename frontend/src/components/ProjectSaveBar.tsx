import { useEffect } from 'react'
import { ProjectFileActions } from './ProjectFileActions'
import { useSaveProject } from '../context/SaveProjectContext'

type ProjectSaveBarProps = {
  /** Shorter helper text on Setup; fuller note on Dashboard. */
  variant?: 'setup' | 'compact'
}

/** Save working case to the database (prospect + all tanks + setup labels). */
export function ProjectSaveBar({ variant: _variant = 'setup' }: ProjectSaveBarProps) {
  const {
    saveProject,
    saveOk,
    setSaveOk,
    saveError,
    setSaveError,
    projectName,
    setProjectName,
    loading,
    canSave,
    hasUnsavedChanges,
  } = useSaveProject()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (canSave && !loading) void saveProject()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveProject, canSave, loading])

  return (
    <div className="card project-save-bar">
      <div className="project-save-bar-inner">
        <label className="project-save-name">
          <span className="project-save-name-label">Project name</span>
          <input
            type="text"
            value={projectName}
            onChange={(e) => {
              setSaveOk(null)
              setSaveError(null)
              setProjectName(e.target.value)
            }}
            disabled={!canSave || loading}
            placeholder="Prospect name"
          />
        </label>
        <div className="project-save-actions">
          {hasUnsavedChanges && (
            <span className="project-save-unsaved" title="Not yet written to the database">
              Unsaved changes
            </span>
          )}
          <ProjectFileActions
            layout="bar"
            onExported={(msg) => {
              setSaveError(null)
              setSaveOk(msg)
            }}
            onImported={(msg) => {
              setSaveError(null)
              setSaveOk(msg)
            }}
            onError={(msg) => {
              setSaveOk(null)
              setSaveError(msg)
            }}
          />
          <button
            type="button"
            className="primary"
            onClick={() => void saveProject()}
            disabled={loading || !canSave || !projectName.trim()}
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {saveError && (
        <div className="alert error project-save-error" role="alert">
          <p style={{ margin: 0 }}>{saveError}</p>
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: '0.5rem' }}
            onClick={() => setSaveError(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      {saveOk && (
        <p className="alert success project-save-ok" role="status">
          {saveOk}
        </p>
      )}
    </div>
  )
}
