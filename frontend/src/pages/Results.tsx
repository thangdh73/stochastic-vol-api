import { Link } from 'react-router-dom'
import { ResultsTable } from '../components/ResultsTable'
import { useWorkflow } from '../context/WorkflowContext'
import type { ScopeBreakdownRow } from '../types/api'

function fmt(v: number | undefined): string {
  if (v == null || Number.isNaN(v)) return '—'
  if (Math.abs(v) >= 100) return v.toFixed(2)
  if (Math.abs(v) >= 10) return v.toFixed(3)
  return v.toFixed(4)
}

function BreakdownTable({
  title,
  rows,
  prospectMean,
}: {
  title: string
  rows: ScopeBreakdownRow[]
  prospectMean: number
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
                <td>{r.label}</td>
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
  const { simulation } = useWorkflow()

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
              />
              <BreakdownTable
                title="By segment"
                rows={simulation.breakdown.segments}
                prospectMean={simulation.breakdown.prospect.summaries.total_mmboe?.mean_trimmed ?? 0}
              />
              <BreakdownTable
                title="By tank"
                rows={simulation.breakdown.tanks}
                prospectMean={simulation.breakdown.prospect.summaries.total_mmboe?.mean_trimmed ?? 0}
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
