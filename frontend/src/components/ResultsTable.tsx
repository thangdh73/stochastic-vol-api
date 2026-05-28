import type { PercentileSummary, SimulateResponse } from '../types/api'
import { CcopPgRiskReview } from './CcopPgRiskReview'

function formatNum(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return '—'
  if (Math.abs(n) >= 100) return n.toFixed(2)
  if (Math.abs(n) >= 10) return n.toFixed(3)
  return n.toFixed(4)
}

function summaryRows(result: SimulateResponse['result']): PercentileSummary[] {
  const rows: (PercentileSummary | null | undefined)[] = [
    result.stoiip,
    result.recoverable_oil,
    result.solution_gas,
    result.giip,
    result.recoverable_gas,
    result.condensate,
    result.total_mmboe,
  ]
  return rows.filter((r): r is PercentileSummary => r != null)
}

interface ResultsTableProps {
  simulation: SimulateResponse
}

export function ResultsTable({ simulation }: ResultsTableProps) {
  const { result } = simulation
  const rows = summaryRows(result)
  const pg = result.chance_applied === false ? null : result.pg_result
  const showRecoveryWarning = result.oil_recovery_applied === false
  const showChanceNa = result.chance_applied === false
  const condP50 = result.condensate?.p50
  const showCondensateWarning =
    result.condensate != null && (condP50 == null || condP50 <= 0)
  const hasRiskReview = Boolean(pg?.risk_review?.length)

  return (
    <div>
      {showCondensateWarning && (
        <div className="alert warn" role="status">
          Condensate is zero or negligible — check <strong>HC Yield → Condensate yield</strong>{' '}
          (bbl/MMscf) on a <strong>Gas condensate</strong> case. Default used to be 0; typical values are
          20–100 bbl/MMscf.
        </div>
      )}
      {showRecoveryWarning && (
        <div className="alert warn" role="status">
          Oil recovery was not applied: recoverable oil equals STOIIP (in-place proxy).
          Do not interpret as PRMS recoverable resources or reserves.
        </div>
      )}

      <h3 className="results-section-title">Unrisked resource estimates</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Unit</th>
            <th>P99</th>
            <th>P90</th>
            <th>P50</th>
            <th>Mean P99→P01</th>
            <th>P10</th>
            <th>P01</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.product_name}>
              <td>{row.product_name}</td>
              <td>{row.unit}</td>
              <td>{formatNum(row.p99)}</td>
              <td>{formatNum(row.p90)}</td>
              <td>{formatNum(row.p50)}</td>
              <td>{formatNum(row.mean_trimmed)}</td>
              <td>{formatNum(row.p10)}</td>
              <td>{formatNum(row.p01)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!showChanceNa && pg && (
        <>
          <h3 className="results-section-title" style={{ marginTop: '1.25rem' }}>
            Risked resources (Pg applied)
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Unit</th>
                <th>P99</th>
                <th>P90</th>
                <th>P50</th>
                <th>Mean P99→P01</th>
                <th>P10</th>
                <th>P01</th>
              </tr>
            </thead>
            <tbody>
              <tr className="ccop-factor-summary-pg">
                <td>Pg (geologic chance of success)</td>
                <td>fraction</td>
                <td colSpan={4} />
                <td>{formatNum(pg.pg)}</td>
                <td colSpan={2}>
                  <span className="muted">{(pg.pg * 100).toFixed(2)}%</span>
                </td>
              </tr>
              <tr>
                <td>Pg-risked mean (total MMBOE)</td>
                <td>{pg.resource_unit}</td>
                <td colSpan={4} />
                <td>{formatNum(pg.pg_risked_mean)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>

          {hasRiskReview && (
            <div style={{ marginTop: '1rem' }}>
              <CcopPgRiskReview
                rows={pg.risk_review!}
                pg={pg.pg}
                title="Pg &amp; risk review"
                subtitle="CCOP factor summary and prospect rationale (from simulation input)."
              />
            </div>
          )}
        </>
      )}

      {showChanceNa && (
        <p className="alert info" style={{ marginTop: '1rem' }}>
          Chance was not applied — Pg and Pg-risked volumes are not available.
        </p>
      )}

      <dl className="meta-grid" style={{ marginTop: '1rem' }}>
        <div>
          <dt>Seed</dt>
          <dd>{simulation.result.seed}</dd>
        </div>
        <div>
          <dt>Iterations</dt>
          <dd>{simulation.result.n_iterations}</dd>
        </div>
        <div>
          <dt>Engine</dt>
          <dd>{simulation.engine_version}</dd>
        </div>
        <div>
          <dt>Input hash</dt>
          <dd>{simulation.input_hash}</dd>
        </div>
        <div>
          <dt>Convention</dt>
          <dd style={{ fontSize: '0.8rem' }}>{simulation.result.percentile_convention}</dd>
        </div>
      </dl>
    </div>
  )
}
