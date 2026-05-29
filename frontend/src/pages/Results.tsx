import { Link } from 'react-router-dom'
import { ResultsTable } from '../components/ResultsTable'
import { useWorkflow } from '../context/WorkflowContext'
import type { ScopeBreakdownRow } from '../types/api'
import { tankCode } from '../utils/tankLabels'

function fmt(v: number | undefined): string {
  if (v == null || Number.isNaN(v)) return '—'
  if (Math.abs(v) >= 100) return v.toFixed(2)
  if (Math.abs(v) >= 10) return v.toFixed(3)
  return v.toFixed(4)
}

function tankDisplayLabel(
  row: ScopeBreakdownRow,
  segmentNameById: Record<string, string>,
  reservoirNameById: Record<string, string>,
  segmentIndexById: Record<string, number>,
  reservoirIndexById: Record<string, number>,
): string {
  const sid = row.segment_id
  const rid = row.reservoir_id
  if (!sid || !rid) return row.label || row.id
  const segName = segmentNameById[sid] ?? sid
  const resName = reservoirNameById[rid] ?? rid
  const segIdx = segmentIndexById[sid]
  const resIdx = reservoirIndexById[rid]
  const code =
    Number.isFinite(segIdx) && Number.isFinite(resIdx) ? tankCode(resIdx, segIdx) : null
  return code ? `${code} — ${resName} – ${segName}` : `${resName} – ${segName}`
}

function BreakdownTable({
  title,
  rows,
  prospectMean,
  resolveLabel,
}: {
  title: string
  rows: ScopeBreakdownRow[]
  prospectMean: number
  resolveLabel?: (row: ScopeBreakdownRow) => string
}) {
  if (!rows.length) return null
  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <h3>{title}</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Scope</th>
            <th>Unit</th>
            <th>P90</th>
            <th>P50</th>
            <th>Mean</th>
            <th>P10</th>
            <th>Contribution % (mean)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = r.summaries.total_mmboe
            const mean = s?.mean_trimmed
            const c = prospectMean > 0 && mean != null ? (mean / prospectMean) * 100 : undefined
            return (
              <tr key={r.id}>
                <td>{resolveLabel ? resolveLabel(r) : r.label}</td>
                <td>{s?.unit ?? 'MMBOE'}</td>
                <td>{fmt(s?.p90)}</td>
                <td>{fmt(s?.p50)}</td>
                <td>{fmt(mean)}</td>
                <td>{fmt(s?.p10)}</td>
                <td>{c == null ? '—' : `${c.toFixed(2)}%`}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function ResultsPage() {
  const { simulation, segments, reservoirs } = useWorkflow()
  const segmentNameById = Object.fromEntries(segments.map((s) => [s.id, s.name]))
  const reservoirNameById = Object.fromEntries(reservoirs.map((r) => [r.id, r.name]))
  const segmentIndexById = Object.fromEntries(segments.map((s, i) => [s.id, i]))
  const reservoirIndexById = Object.fromEntries(reservoirs.map((r, i) => [r.id, i]))

  return (
    <div>
      <h1 className="page-title">Results</h1>
      <p className="page-desc">
        Resource summaries using P10-large convention (P90 conservative, P10
        upside).
      </p>

      {!simulation && (
        <div className="alert info">
          No simulation results yet.{' '}
          <Link to="/simulation">Run a simulation</Link> first.
        </div>
      )}

      {simulation && (
        <>
          <div className="card">
            <h2>{simulation.result.prospect_name}</h2>
            <ResultsTable simulation={simulation} />
          </div>
          {simulation.breakdown && (
            <>
              <div className="card" style={{ marginTop: '1rem' }}>
                <h2>Breakdown (Total MMBOE)</h2>
                <p className="convention-inline">
                  Mean contribution by scope relative to prospect total mean.
                </p>
              </div>
              <BreakdownTable
                title="By reservoir"
                rows={simulation.breakdown.reservoirs}
                prospectMean={simulation.breakdown.prospect.summaries.total_mmboe?.mean_trimmed ?? 0}
                resolveLabel={(r) => reservoirNameById[r.id] ?? r.label}
              />
              <BreakdownTable
                title="By segment"
                rows={simulation.breakdown.segments}
                prospectMean={simulation.breakdown.prospect.summaries.total_mmboe?.mean_trimmed ?? 0}
                resolveLabel={(r) => segmentNameById[r.id] ?? r.label}
              />
              <BreakdownTable
                title="By tank"
                rows={simulation.breakdown.tanks}
                prospectMean={simulation.breakdown.prospect.summaries.total_mmboe?.mean_trimmed ?? 0}
                resolveLabel={(r) =>
                  tankDisplayLabel(
                    r,
                    segmentNameById,
                    reservoirNameById,
                    segmentIndexById,
                    reservoirIndexById,
                  )
                }
              />
            </>
          )}
          <p className="nav-hint">
            <Link to="/charts">View Charts &amp; QC plots →</Link>
            {simulation.result.arrays
              ? ' (histograms, exceedance, scatter, tornado sensitivity)'
              : ' — re-run simulation to include arrays'}
          </p>
        </>
      )}
    </div>
  )
}
