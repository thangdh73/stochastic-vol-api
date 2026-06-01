import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PetrelCumulativeCharts } from '../components/charts/PetrelCumulativeCharts'
import { PetrelCumulativeTornadoPanel } from '../components/charts/PetrelCumulativeTornadoPanel'
import { useWorkflow } from '../context/WorkflowContext'
import type { PetrelCumulativeRunResult } from '../types/api'

function StatTable({
  title,
  rows,
}: {
  title: string
  rows: Array<{ label: string; p90: number; p50: number; mean: number; p10: number; unit: string }>
}) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>P90</th>
            <th>P50</th>
            <th>Mean</th>
            <th>P10</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td>{r.p90.toFixed(2)}</td>
              <td>{r.p50.toFixed(2)}</td>
              <td>{r.mean.toFixed(2)}</td>
              <td>{r.p10.toFixed(2)}</td>
              <td>{r.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function exportJson(result: PetrelCumulativeRunResult) {
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'petrel_cumulative_results.json'
  a.click()
  URL.revokeObjectURL(url)
}

function exportCsv(result: PetrelCumulativeRunResult) {
  const lines = ['scope,category,p90,p50,mean,p10,unit']
  for (const cat of ['1P', '2P', '3P'] as const) {
    const s = result.field[cat]
    lines.push(`field,${cat},${s.p90},${s.p50},${s.mean_trimmed},${s.p10},${s.unit}`)
  }
  for (const seg of result.segments) {
    for (const cat of ['1P', '2P', '3P'] as const) {
      const s = seg[cat]
      lines.push(`${seg.label},${cat},${s.p90},${s.p50},${s.mean_trimmed},${s.p10},${s.unit}`)
    }
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'petrel_cumulative_results.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function PetrelCumulativeResultsPage() {
  const { petrelCumulativeResult, error } = useWorkflow()

  const fieldRows = useMemo(() => {
    if (!petrelCumulativeResult) return []
    return (['1P', '2P', '3P'] as const).map((cat) => ({
      label: cat,
      p90: petrelCumulativeResult.field[cat].p90,
      p50: petrelCumulativeResult.field[cat].p50,
      mean: petrelCumulativeResult.field[cat].mean_trimmed,
      p10: petrelCumulativeResult.field[cat].p10,
      unit: petrelCumulativeResult.field[cat].unit,
    }))
  }, [petrelCumulativeResult])

  if (!petrelCumulativeResult) {
    return (
      <div>
        <h2 className="page-title">Petrel cumulative results</h2>
        <p className="alert info">
          No Petrel cumulative run yet.{' '}
          <Link to="/output/simulation">Run simulation</Link> with Petrel cumulative GRV mode.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="page-title">Petrel cumulative results</h2>
      <p className="page-desc">{petrelCumulativeResult.formula_note}</p>
      {error && <div className="alert error">{error}</div>}

      <div className={`alert ${petrelCumulativeResult.iteration_qc_pass ? 'info' : 'warn'}`}>
        Iteration QC:{' '}
        {petrelCumulativeResult.iteration_qc_pass
          ? 'All iterations maintained GIIP 1P ≤ 2P ≤ 3P.'
          : `${petrelCumulativeResult.iteration_qc_violations} ordering violation(s).`}
      </div>

      <StatTable title="Field roll-up" rows={fieldRows} />

      <div className="card">
        <h3>Monte Carlo charts</h3>
        <p className="chart-caption">
          Histogram, exceedance, and percentile views for field and segment GIIP (1P / 2P / 3P).
        </p>
        <PetrelCumulativeCharts result={petrelCumulativeResult} />
      </div>

      <div className="card">
        <h3>Segment × category</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Segment</th>
              <th>Category</th>
              <th>P90</th>
              <th>P50</th>
              <th>Mean</th>
              <th>P10</th>
            </tr>
          </thead>
          <tbody>
            {petrelCumulativeResult.segments.flatMap((seg) =>
              (['1P', '2P', '3P'] as const).map((cat) => (
                <tr key={`${seg.tank_key}-${cat}`}>
                  <td>{seg.label}</td>
                  <td>{cat}</td>
                  <td>{seg[cat].p90.toFixed(2)}</td>
                  <td>{seg[cat].p50.toFixed(2)}</td>
                  <td>{seg[cat].mean_trimmed.toFixed(2)}</td>
                  <td>{seg[cat].p10.toFixed(2)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      <div className="btn-row">
        <button type="button" onClick={() => exportCsv(petrelCumulativeResult)}>
          Export CSV
        </button>
        <button type="button" onClick={() => exportJson(petrelCumulativeResult)}>
          Export JSON
        </button>
        <Link className="btn-link" to="/expectation-curve">
          Open expectation curve
        </Link>
      </div>

      <PetrelCumulativeTornadoPanel />
    </div>
  )
}
