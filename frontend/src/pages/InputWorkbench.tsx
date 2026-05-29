import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { InputActiveTankBar } from '../components/InputActiveTankBar'
import { InputRockVolumeTable } from '../components/InputRockVolumeTable'
import { RockVolumeEditor, RockVolumeEditorCollapsed } from '../components/RockVolumeEditor'
import { HcYieldEditor } from '../components/HcYieldEditor'
import { TankRockVolumeCopyPanel } from '../components/TankRockVolumeCopyPanel'
import { useWorkflow } from '../context/WorkflowContext'
import { effectiveEstimatingMethod } from '../utils/estimatingMethod'

/** Rock volume: all-tanks summary + active-tank editor on one page. */
export function InputRockVolumePage() {
  const { input, setInput } = useWorkflow()
  const [editorOpen, setEditorOpen] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  const scrollToEditor = useCallback(() => {
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const openEditor = useCallback(() => {
    setEditorOpen(true)
    scrollToEditor()
  }, [scrollToEditor])

  const closeEditor = useCallback(() => {
    setEditorOpen(false)
    if (window.location.hash) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}`,
      )
    }
  }, [])

  useEffect(() => {
    if (location.hash === '#active-tank-editor') {
      setEditorOpen(true)
      scrollToEditor()
    }
  }, [location.hash, scrollToEditor])

  const handleEditTank = useCallback(
    (_segmentId: string, _reservoirId: string) => {
      openEditor()
    },
    [openEditor],
  )

  const showPetrelHint =
    input &&
    effectiveEstimatingMethod(input) === 'nrv_grv_yield' &&
    input.nrv_entry_mode !== 'petrel_marginals'

  return (
    <div className="input-tab-panel">
      <details className="input-details-panel input-copy-details">
        <summary>Copy rock volume between tanks</summary>
        <div className="input-details-body">
          <TankRockVolumeCopyPanel />
        </div>
      </details>
      <InputRockVolumeTable onEditTank={handleEditTank} />
      <InputActiveTankBar />
      {!editorOpen && showPetrelHint && (
        <div className="alert info input-rock-hint">
          Select <strong>Petrel GRV (3+3)</strong> in the active-tank editor (or click{' '}
          <strong>Edit distributions</strong>) to enter three structural + three contact GRV values.
        </div>
      )}
      <div
        id="active-tank-editor"
        ref={editorRef}
        className="input-active-editor-anchor"
      >
        {editorOpen ? (
          <RockVolumeEditor onDone={closeEditor} />
        ) : (
          <RockVolumeEditorCollapsed
            onOpen={openEditor}
            onPatch={(next) => setInput(next)}
          />
        )}
      </div>
    </div>
  )
}

/** HC yield + petrophysics for active tank. */
export function InputHcYieldPage() {
  return (
    <div className="input-tab-panel">
      <HcYieldEditor />
    </div>
  )
}
