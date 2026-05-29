import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { HcYieldActiveTankEditor } from './HcYieldActiveTankEditor'
import { HcYieldSharingPanel } from './HcYieldSharingPanel'
import { InputActiveTankBar } from './InputActiveTankBar'
import { InputHcYieldControlTable } from './InputHcYieldControlTable'
import { NtgSharingPanel } from './NtgSharingPanel'
import { useWorkflow } from '../context/WorkflowContext'
import { formatDistShort, formatDistTypeShort } from '../utils/distSummary'
import { hcYieldTableColumns, tankShowsNtgColumn } from '../utils/hcYieldControlColumns'
import { showProbabilisticNtgInput } from '../utils/setupInputParams'
import { tankCode } from '../utils/tankLabels'

/** Collapsed strip until user opens the active-tank editor. */
function HcYieldEditorCollapsed({ onOpen }: { onOpen: () => void }) {
  const { input, petroConstants, reservoirs, segments, activeReservoirId, activeSegmentId } =
    useWorkflow()
  if (!input) return null

  const reservoirIndex = reservoirs.findIndex((r) => r.id === activeReservoirId)
  const segmentIndex = segments.findIndex((s) => s.id === activeSegmentId)
  const anyTankNtg = tankShowsNtgColumn(petroConstants, input)
  const columns = hcYieldTableColumns(input, anyTankNtg)

  const tankLabel =
    reservoirIndex >= 0 && segmentIndex >= 0
      ? tankCode(reservoirIndex, segmentIndex)
      : 'Active tank'

  return (
    <div className="card input-editor-collapsed">
      <div className="input-editor-collapsed-inner">
        <div className="input-editor-collapsed-text">
          <h2 className="input-editor-title">{tankLabel} — HC yield</h2>
          <dl className="input-editor-summary-dl">
            {columns.map((col) => {
              const dist = input[col.key]
              if (!dist || typeof dist !== 'object' || !('distribution_type' in dist)) return null
              if (col.key === 'net_to_gross_dist' && !anyTankNtg) return null
              return (
                <div key={col.key}>
                  <dt>{col.label}</dt>
                  <dd>
                    {formatDistShort(dist)}
                    <span className="input-editor-summary-type"> ({formatDistTypeShort(dist)})</span>
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>
        <button type="button" className="input-editor-open-btn" onClick={onOpen}>
          Edit distributions
        </button>
      </div>
    </div>
  )
}

/** HC yield: all-tanks QC table, active-tank bar, then editor (same flow as Rock volume). */
export function HcYieldEditor() {
  const { input, petroConstants } = useWorkflow()
  const location = useLocation()
  const [editorOpen, setEditorOpen] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const showNtg = showProbabilisticNtgInput(petroConstants, input)

  const scrollToEditor = useCallback(() => {
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const openEditor = useCallback(() => {
    setEditorOpen(true)
    scrollToEditor()
  }, [scrollToEditor])

  const closeEditor = useCallback(() => setEditorOpen(false), [])

  const handleEditTank = useCallback(
    (_segmentId: string, _reservoirId: string) => {
      openEditor()
    },
    [openEditor],
  )

  useEffect(() => {
    if (location.hash === '#active-tank-editor') {
      setEditorOpen(true)
      scrollToEditor()
    }
  }, [location.hash, scrollToEditor])

  if (!input) return null

  return (
    <div className="hc-yield-editor">
      {input.fluid_type === 'gas_condensate' && (
        <p className="convention-inline muted">
          Condensate (MMbbl) = Recoverable gas (Bcf) × Condensate yield (bbl/MMscf) ÷ 1000.
        </p>
      )}

      <InputHcYieldControlTable onEditTank={handleEditTank} />

      <InputActiveTankBar />

      <details className="input-details-panel">
        <summary>Sharing &amp; linkage (HC yield, NTG)</summary>
        <div className="input-details-body">
          <HcYieldSharingPanel />
          {showNtg && <NtgSharingPanel />}
        </div>
      </details>

      <div
        id="active-tank-editor"
        ref={editorRef}
        className="input-active-editor-anchor"
      >
        {editorOpen ? (
          <HcYieldActiveTankEditor onDone={closeEditor} />
        ) : (
          <HcYieldEditorCollapsed onOpen={openEditor} />
        )}
      </div>
    </div>
  )
}
