import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkflow } from '../context/WorkflowContext'

export function ExportPage() {
  const { input } = useWorkflow()
  const [busy, setBusy] = useState(false)

  const download = async (format: 'csv' | 'excel') => {
    if (!input) return
    setBusy(true)
    try {
      const path =
        format === 'csv' ? '/api/export/csv' : '/api/export/excel'
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, include_workbook_targets: false }),
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = format === 'csv' ? 'mmra_export.zip' : 'mmra_export.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="page-title">Export</h1>
      <p className="page-desc">Download review-ready CSV (zip) or Excel workbook.</p>

      {!input && (
        <div className="alert info">
          <Link to="/simulation">Load inputs</Link> before exporting.
        </div>
      )}

      {input && (
        <div className="card">
          <h2>Export current input</h2>
          <p style={{ fontSize: '0.88rem', marginBottom: '1rem' }}>
            Runs simulation then exports metadata, inputs, chance, QA/QC, and
            results for <strong>{input.prospect_name}</strong>.
          </p>
          <div className="btn-row">
            <button type="button" onClick={() => download('csv')} disabled={busy}>
              Download CSV (zip)
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => download('excel')}
              disabled={busy}
            >
              Download Excel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
