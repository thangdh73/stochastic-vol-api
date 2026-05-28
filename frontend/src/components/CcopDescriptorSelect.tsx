import { useState } from 'react'
import {
  CCOP_RISK_LOOKUPS,
  lookupRowById,
  lookupRowForP,
  type CcopRiskFactorKey,
} from '../constants/ccopRiskLookups'
import { CcopDescriptorExplainModal } from './CcopDescriptorExplainModal'
import { NumericInput } from './NumericInput'

interface CcopDescriptorSelectProps {
  factorKey: CcopRiskFactorKey
  label: string
  p: number
  onChange: (p: number) => void
  comment?: string
  onCommentChange?: (text: string) => void
}

export function CcopDescriptorSelect({
  factorKey,
  label,
  p,
  onChange,
  comment = '',
  onCommentChange,
}: CcopDescriptorSelectProps) {
  const lookup = CCOP_RISK_LOOKUPS[factorKey]
  const matched = lookupRowForP(factorKey, p)
  const [explainOpen, setExplainOpen] = useState(false)
  const [explainRow, setExplainRow] = useState(matched ?? lookup.rows[2])

  const openExplain = (rowId: string) => {
    const row = lookupRowById(factorKey, rowId)
    if (!row) return
    setExplainRow(row)
    setExplainOpen(true)
  }

  const handleSelect = (rowId: string) => {
    if (!rowId) return
    const row = lookupRowById(factorKey, rowId)
    if (!row) return
    onChange(row.p)
    setExplainRow(row)
    setExplainOpen(true)
  }

  return (
    <>
      <div className="form-grid ccop-desc-select" style={{ marginBottom: '0.75rem' }}>
        <label>
          {label}
          <select
            value={matched?.id ?? ''}
            onChange={(e) => handleSelect(e.target.value)}
          >
            <option value="">Custom P (enter below)…</option>
            {lookup.rows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.pRange} — P = {row.p}
              </option>
            ))}
          </select>
        </label>
        <label>
          P (0–1)
          <NumericInput value={p} onChange={(v) => v != null && onChange(v)} />
        </label>
      </div>

      <div className="ccop-desc-actions">
        <button
          type="button"
          className="btn secondary"
          onClick={() => openExplain(matched?.id ?? lookup.rows[2].id)}
        >
          Explain selection
        </button>
        {matched && (
          <span className="muted ccop-desc-summary">
            {matched.pRange}: {matched.condition.slice(0, 72)}
            {matched.condition.length > 72 ? '…' : ''}
          </span>
        )}
      </div>

      {onCommentChange && (
        <label className="ccop-comment-field">
          Rationale / notes
          <textarea
            rows={2}
            spellCheck
            placeholder="e.g. P = 1 — proved gas in adjacent block / well"
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
          />
        </label>
      )}

      <CcopDescriptorExplainModal
        open={explainOpen}
        onClose={() => setExplainOpen(false)}
        lookup={lookup}
        row={explainRow}
        fieldLabel={label}
      />
    </>
  )
}
