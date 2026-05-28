import { useEffect, useRef } from 'react'
import { LEGACY_WORKBOOK_LABEL } from '../constants/appBranding'
import {
  COMPLEX_TRAP_HELP_SLIDES,
  slideForKey,
  type ComplexTrapHelpKey,
} from '../constants/complexTrapHelp'

interface ComplexTrapHelpModalProps {
  open: boolean
  onClose: () => void
  selectedKey: ComplexTrapHelpKey
  onSelectKey: (key: ComplexTrapHelpKey) => void
}

export function ComplexTrapHelpModal({
  open,
  onClose,
  selectedKey,
  onSelectKey,
}: ComplexTrapHelpModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const slide = slideForKey(selectedKey)

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
          <h2>Complex trap — workbook logic</h2>
          <button type="button" className="ct-help-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="ct-help-tabs">
          {COMPLEX_TRAP_HELP_SLIDES.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`ct-help-tab ${selectedKey === s.key ? 'active' : ''}`}
              onClick={() => onSelectKey(s.key)}
            >
              Method {s.method}, {s.elements} element{s.elements > 1 ? 's' : ''}
            </button>
          ))}
        </div>

        <figure className="ct-help-figure">
          <img
            src={slide.imageSrc}
            alt={slide.title}
            className="ct-help-image"
          />
          <figcaption>{slide.title}</figcaption>
        </figure>

        <div className="ct-help-summary">
          <h3>How the web engine applies this</h3>
          <ul>
            {slide.summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <footer className="ct-help-footer">
          <p className="convention-inline">
            Diagrams follow the {LEGACY_WORKBOOK_LABEL} Complex Traps. Seal confidence on the form is P(seal)
            for each CT element (0–100%).
          </p>
          <button type="button" className="primary" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </dialog>
  )
}
