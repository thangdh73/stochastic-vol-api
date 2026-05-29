import { useRef, useState } from 'react'
import { useSaveProject } from '../context/SaveProjectContext'
import { useWorkflow } from '../context/WorkflowContext'
import {
  buildProjectFile,
  downloadProjectFile,
  MMRA_PROJECT_FILE_EXTENSION,
  ProjectFileError,
  readProjectFileFromBlob,
} from '../utils/projectFile'

type ProjectFileActionsProps = {
  layout?: 'bar' | 'card'
  onImported?: (message: string) => void
  onExported?: (message: string) => void
  onError?: (message: string) => void
}

export function ProjectFileActions({
  layout = 'card',
  onImported,
  onExported,
  onError,
}: ProjectFileActionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const {
    input,
    getEnvelopeForSave,
    loadFromEnvelope,
    setActiveProject,
    setValidation,
    setSimulation,
    clearModulePreviews,
  } = useWorkflow()
  const { projectName, setProjectName, resetSaved } = useSaveProject()

  const envelope = getEnvelopeForSave()
  const canExport = Boolean(input && envelope)

  const handleExport = () => {
    if (!input || !envelope) {
      onError?.('Nothing to export — set up a prospect first.')
      return
    }
    try {
      const file = buildProjectFile(projectName, input, envelope)
      downloadProjectFile(file)
      onExported?.(
        `Exported “${file.project_name}” (${file.envelope.segments.length} segment(s), ${file.envelope.reservoirs.length} reservoir(s)).`,
      )
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Export failed')
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const projectFile = await readProjectFileFromBlob(file)
      loadFromEnvelope(projectFile.envelope)
      setValidation(null)
      setSimulation(null)
      clearModulePreviews()
      setActiveProject(null)
      setProjectName(projectFile.project_name)
      resetSaved()
      const tanks =
        projectFile.envelope.segments.length * projectFile.envelope.reservoirs.length
      onImported?.(
        `Imported “${projectFile.project_name}” (${tanks} tank${tanks === 1 ? '' : 's'}).`,
      )
    } catch (e) {
      const message =
        e instanceof ProjectFileError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Import failed'
      onError?.(message)
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const accept = `.json,${MMRA_PROJECT_FILE_EXTENSION},application/json`

  if (layout === 'bar') {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          hidden
          onChange={(e) => void handleFileSelected(e.target.files?.[0])}
        />
        <button
          type="button"
          className="btn-secondary"
          onClick={handleImportClick}
          disabled={busy}
        >
          {busy ? 'Importing…' : 'Open file…'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={handleExport}
          disabled={!canExport || busy}
          title={
            canExport
              ? `Download ${MMRA_PROJECT_FILE_EXTENSION}`
              : 'Set up inputs before exporting'
          }
        >
          Export file…
        </button>
      </>
    )
  }

  return (
    <div className="card project-file-card">
      <h2 style={{ marginTop: 0 }}>Project file</h2>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => void handleFileSelected(e.target.files?.[0])}
      />
      <div className="btn-row">
        <button
          type="button"
          className="primary"
          onClick={handleImportClick}
          disabled={busy}
        >
          {busy ? 'Importing…' : 'Open project file…'}
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={!canExport || busy}
        >
          Export project file…
        </button>
      </div>
    </div>
  )
}
