import { useEffect, useRef } from 'react'
import type { DistributionSpec, DistributionPreviewResponse } from '../types/api'
import { DistributionHistogramChart } from './charts/DistributionHistogramChart'
import { formatDistShort } from '../utils/distSummary'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  dist: DistributionSpec
  preview: DistributionPreviewResponse | null
  loading: boolean
  error: string | null
  asPercent?: boolean
}

export function DistributionHistogramModal({
  open,
  onClose,
  title,
  dist,
  preview,
  loading,
  error,
  asPercent = false,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    if (!open && dlg.open) dlg.close()
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      className="ct-help-dialog dist-qc-dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
    >
      <div className="ct-help-panel dist-qc-panel">
        <div className="ct-help-header">
          <div>
            <h2>{title} — distribution QC</h2>
            <p className="convention-inline muted" style={{ margin: '0.25rem 0 0' }}>
              Input: {formatDistShort(dist)}
            </p>
          </div>
          <button type="button" className="ct-help-close" onClick={onClose}>
            Close
          </button>
        </div>

        {loading && <p className="convention-inline">Sampling distribution…</p>}
        {error && <p className="alert error">{error}</p>}
        {!loading && !error && preview && (
          <DistributionHistogramChart
            samples={preview.samples}
            summary={preview.summary}
            dist={dist}
            inputMarkers={preview.input_markers}
            asPercent={asPercent}
          />
        )}
      </div>
    </dialog>
  )
}
