import { useRef, useState } from 'react'
import type { HcYieldControlColumn } from '../utils/hcYieldControlColumns'
import {
  applyHcYieldCsvRow,
  buildHcYieldCsvTemplate,
  downloadTextFile,
  exportHcYieldCsv,
  parseDelimitedTable,
  type HcYieldImportResult,
} from '../utils/hcYieldTableCsv'
import type { SimulationInput } from '../types/api'
import type { DistKey } from '../utils/inputHelpers'
import { buildTankRows } from '../utils/tankLabels'

type Props = {
  columns: HcYieldControlColumn[]
  rows: ReturnType<typeof buildTankRows>
  getTankInput: (segmentId: string, reservoirId: string) => SimulationInput | null
  patchTankInput: (segmentId: string, reservoirId: string, next: SimulationInput) => void
  getDist: (tank: SimulationInput, key: DistKey) => import('../types/api').DistributionSpec | null
}

export function HcYieldTableToolbar({
  columns,
  rows,
  getTankInput,
  patchTankInput,
  getDist,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState<HcYieldImportResult | null>(null)

  const downloadTemplate = () => {
    const csv = buildHcYieldCsvTemplate(columns, rows)
    downloadTextFile('mmra_hc_yield_template.csv', csv)
  }

  const exportCurrent = () => {
    const csv = exportHcYieldCsv(columns, rows, getTankInput, getDist)
    downloadTextFile('mmra_hc_yield_export.csv', csv)
  }

  const onFile = async (file: File) => {
    const text = await file.text()
    const parsed = parseDelimitedTable(text)
    const result: HcYieldImportResult = { updated: 0, skipped: [], errors: [] }

    if (!parsed.length) {
      result.errors.push('No data rows found. Use the template or export format.')
      setImportMsg(result)
      return
    }

    for (let i = 0; i < parsed.length; i++) {
      const csvRow = parsed[i]
      const tankRow = rows.find(
        (r) =>
          (csvRow['SEGMENT'] &&
            csvRow['RESERVOIR'] &&
            r.segmentName.toLowerCase() === csvRow['SEGMENT'].toLowerCase() &&
            r.reservoirName.toLowerCase() === csvRow['RESERVOIR'].toLowerCase()) ||
          (csvRow['UNIQUE ID'] &&
            r.uniqueId.toLowerCase() === csvRow['UNIQUE ID'].toLowerCase()),
      )
      if (!tankRow) {
        result.skipped.push(`Row ${i + 2}: tank not found`)
        continue
      }
      const tank = getTankInput(tankRow.segmentId, tankRow.reservoirId)
      if (!tank) {
        result.skipped.push(`Row ${i + 2}: ${tankRow.uniqueId} — no input`)
        continue
      }
      try {
        const next = applyHcYieldCsvRow(tank, csvRow, columns)
        patchTankInput(tankRow.segmentId, tankRow.reservoirId, next)
        result.updated++
      } catch (e) {
        result.errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    setImportMsg(result)
  }

  return (
    <div className="hc-yield-table-toolbar">
      <div className="hc-yield-table-toolbar-actions">
        <button type="button" className="btn-secondary btn-sm" onClick={downloadTemplate}>
          Download template (CSV)
        </button>
        <button type="button" className="btn-secondary btn-sm" onClick={exportCurrent}>
          Export current (CSV)
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => fileRef.current?.click()}
        >
          Import CSV / Excel
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void onFile(f)
          }}
        />
      </div>
      <p className="convention-inline muted hc-yield-toolbar-hint">
        Edit in Excel, then <strong>Save As → CSV</strong> and import. Columns: Segment, Reservoir,
        Unique ID, then <strong>Poro/Sw/FVF/NTG (L)(B)(H)</strong> and Type. L = low (P90), B =
        base (P50), H = high (P10). Poro and Sw as <strong>fraction</strong> (e.g. 0.2); whole
        numbers 1–100 are read as percent (20 → 0.2).
      </p>
      {importMsg && (
        <div
          className={
            importMsg.errors.length
              ? 'alert warn hc-yield-import-msg'
              : 'alert info hc-yield-import-msg'
          }
        >
          <p style={{ margin: '0 0 0.35rem' }}>
            Import: <strong>{importMsg.updated}</strong> tank(s) updated.
            {importMsg.skipped.length > 0 && <> Skipped {importMsg.skipped.length} row(s).</>}
          </p>
          {(importMsg.errors.length > 0 || importMsg.skipped.length > 0) && (
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.88rem' }}>
              {[...importMsg.errors, ...importMsg.skipped.slice(0, 5)].map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          <button type="button" className="btn-secondary btn-sm" onClick={() => setImportMsg(null)}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
