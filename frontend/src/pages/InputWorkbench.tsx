import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { InputActiveTankBar } from '../components/InputActiveTankBar'
import { InputRockVolumeTable } from '../components/InputRockVolumeTable'
import { PetrelCumulativeGrvMatrix } from '../components/PetrelCumulativeGrvMatrix'
import { RockVolumeEditor, RockVolumeEditorCollapsed } from '../components/RockVolumeEditor'
import { RockVolumeEntryModePicker } from '../components/RockVolumeEntryModePicker'
import { HcYieldEditor } from '../components/HcYieldEditor'
import { TankRockVolumeCopyPanel } from '../components/TankRockVolumeCopyPanel'
import { useWorkflow } from '../context/WorkflowContext'
import { effectiveEstimatingMethod } from '../utils/estimatingMethod'
import { isNrvDirectFromNtgConstant } from '../utils/setupInputParams'
import type { NrvEntryMode } from '../types/api'

/** Rock volume: all-tanks summary + active-tank editor on one page. */
export function InputRockVolumePage() {
  const {
    input,
    setInput,
    segments,
    reservoirs,
    petrelCumulativeGrv,
    setPetrelCumulativeGrv,
    isPetrelCumulativeActive,
    setProspectNrvEntryMode,
    grvParamLabels,
    petroConstants,
  } = useWorkflow()
  const [editorOpen, setEditorOpen] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  const entryMode: NrvEntryMode = input?.nrv_entry_mode ?? 'grv_fill_ntg'
  const showCumulativePanel = isPetrelCumulativeActive || entryMode === 'petrel_cumulative_structure'
  const showStandardRockTable = !showCumulativePanel
  const showPerTankEditor =
    showStandardRockTable && entryMode !== 'petrel_marginals' && entryMode !== 'direct'

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
    entryMode === 'grv_fill_ntg'

  return (
    <div className="input-tab-panel">
      {input && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Rock volume entry mode</h3>
          <RockVolumeEntryModePicker
            input={input}
            ntgConstantOnSetup={isNrvDirectFromNtgConstant(petroConstants, input)}
            onPatch={(next) => setInput(next)}
            onSetProspectMode={setProspectNrvEntryMode}
            onSelectCumulative={() => setProspectNrvEntryMode('petrel_cumulative_structure')}
            compact
          />
        </div>
      )}

      {showCumulativePanel && (
        <PetrelCumulativeGrvMatrix
          block={petrelCumulativeGrv}
          segments={segments}
          reservoirs={reservoirs}
          grvParamLabels={grvParamLabels}
          grvUnit={input?.grv_input_unit ?? 'acre_ft'}
          onChange={setPetrelCumulativeGrv}
        />
      )}

      {showStandardRockTable && (
        <>
          <details className="input-details-panel input-copy-details">
            <summary>Copy rock volume between tanks</summary>
            <div className="input-details-body">
              <TankRockVolumeCopyPanel />
            </div>
          </details>
          <InputRockVolumeTable onEditTank={handleEditTank} />
        </>
      )}

      {entryMode === 'petrel_marginals' && (
        <>
          <InputActiveTankBar />
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
        </>
      )}

      {showPerTankEditor && (
        <>
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
              <RockVolumeEditor
                onDone={closeEditor}
                onSelectCumulative={() => setProspectNrvEntryMode('petrel_cumulative_structure')}
              />
            ) : (
              <RockVolumeEditorCollapsed
                onOpen={openEditor}
                onPatch={(next) => setInput(next)}
                onSelectCumulative={() => setProspectNrvEntryMode('petrel_cumulative_structure')}
              />
            )}
          </div>
        </>
      )}

      {showCumulativePanel && (
        <div className="alert info">
          Petrel cumulative mode: use the GRV matrix above. Edit NTG / porosity / Sw / GEF on the HC
          Yield tab (GEF is gas expansion factor, not Bg). The per-tank P1/P2/P3 distribution table is
          hidden in this mode.
        </div>
      )}
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
