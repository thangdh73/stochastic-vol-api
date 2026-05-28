import { useEffect, useRef } from 'react'
import type { CcopRiskFactorLookup, CcopRiskLookupRow } from '../constants/ccopRiskLookups'

interface CcopDescriptorExplainModalProps {
  open: boolean
  onClose: () => void
  lookup: CcopRiskFactorLookup
  row: CcopRiskLookupRow | null
  fieldLabel: string
}

export function CcopDescriptorExplainModal({
  open,
  onClose,
  lookup,
  row,
  fieldLabel,
}: CcopDescriptorExplainModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    if (open && row && !dlg.open) dlg.showModal()
    if (!open && dlg.open) dlg.close()
  }, [open, row])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !row) return null

  return (
    <dialog
      ref={dialogRef}
      className="ct-help-dialog ccop-desc-dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
    >
      <div className="ct-help-panel">
        <header className="ct-help-header">
          <h2>{lookup.title}</h2>
          <button type="button" className="ct-help-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="ct-help-body">
          <p className="muted" style={{ marginTop: 0 }}>
            {fieldLabel}
          </p>
          <p className="ccop-desc-question">{lookup.question}</p>

          <table className="ccop-lookup-table" role="presentation">
            <tbody>
              <tr className="ccop-lookup-row active">
                <td className="ccop-lookup-range">
                  <strong>{row.pRange}</strong>
                  <div className="ccop-lookup-p">P = {row.p}</div>
                </td>
                <td className="ccop-lookup-text">
                  <p className="ccop-lookup-condition">{row.condition}</p>
                  <p className="ccop-lookup-criteria">{row.criteria}</p>
                </td>
              </tr>
            </tbody>
          </table>

          <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 0 }}>
            CCOP probability principal descriptors. Select another band from the dropdown
            to view a different explanation.
          </p>
        </div>

        <footer className="ccop-desc-footer">
          <button type="button" className="primary" onClick={onClose}>
            OK — use P = {row.p}
          </button>
        </footer>
      </div>
    </dialog>
  )
}
