import { useEffect, useRef } from 'react'
import {
  ESTIMATING_METHOD_HELP,
  slideForEstimatingKey,
  type EstimatingMethodHelpKey,
} from '../constants/estimatingMethodHelp'

interface EstimatingMethodHelpModalProps {
  open: boolean
  onClose: () => void
  selectedKey: EstimatingMethodHelpKey
  onSelectKey: (key: EstimatingMethodHelpKey) => void
}

export function EstimatingMethodHelpModal({
  open,
  onClose,
  selectedKey,
  onSelectKey,
}: EstimatingMethodHelpModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const slide = slideForEstimatingKey(selectedKey)

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
      className="ct-help-dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
    >
      <div className="ct-help-panel">
        <header className="ct-help-header">
          <h2>Estimating method</h2>
          <button type="button" className="ct-help-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="ct-help-tabs">
          {ESTIMATING_METHOD_HELP.map((s) => (
            <button
              key={s.key}
              type="button"
              className={s.key === selectedKey ? 'ct-help-tab active' : 'ct-help-tab'}
              onClick={() => onSelectKey(s.key)}
            >
              {s.title}
            </button>
          ))}
        </div>

        <div className="ct-help-body">
          <p className="ct-help-short">{slide.short}</p>
          <p>{slide.explain}</p>
          {slide.diagramSrc && (
            <figure className="ct-help-figure">
              <img
                src={slide.diagramSrc}
                alt={`${slide.title} workflow diagram`}
                className="ct-help-diagram"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
              <figcaption className="muted">
                Place workbook diagram at{' '}
                <code>{slide.diagramSrc.replace(/^\//, 'frontend/public/')}</code>
              </figcaption>
            </figure>
          )}
        </div>
      </div>
    </dialog>
  )
}
