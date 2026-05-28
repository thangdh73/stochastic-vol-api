import { Fragment } from 'react'
import {
  ccopPgFromFactorSummary,
  extractCcopFactorSummary,
  groupCcopDetailRows,
  type CcopRiskReviewRow,
} from '../constants/ccopChance'

interface CcopPgRiskReviewProps {
  rows: CcopRiskReviewRow[]
  /** Optional cross-check; Overall Pg is always P1 × P2 × P3 × P4 from the table. */
  pg?: number | null
  title?: string
  subtitle?: string
}

function formatP(p: number, decimals = 4): string {
  if (p >= 0.9995 && decimals >= 2) return p.toFixed(decimals)
  if (p <= 0.0005 && p > 0 && decimals >= 2) return p.toExponential(2)
  return p.toFixed(decimals)
}

export function CcopPgRiskReview({
  rows,
  pg,
  title = 'Pg risk review',
  subtitle,
}: CcopPgRiskReviewProps) {
  if (!rows.length) return null

  const factorSummary = extractCcopFactorSummary(rows)
  const detailGroups = groupCcopDetailRows(rows)
  const hasComments = rows.some((r) => r.comment.trim().length > 0)
  const overallPg = ccopPgFromFactorSummary(factorSummary)
  const pgMismatch =
    pg != null && Math.abs(overallPg - pg) > 1e-6 && Math.abs(overallPg - pg) / Math.max(pg, 1e-9) > 0.001

  return (
    <div className="ccop-risk-review">
      <h3>{title}</h3>
      {subtitle && <p className="muted convention-inline">{subtitle}</p>}

      <section className="ccop-risk-review-section">
        <h4>CCOP factor summary</h4>
        <p className="muted convention-inline">
          Pg = P<sub>reservoir</sub> × P<sub>trap</sub> × P<sub>charge</sub> × P<sub>retention</sub>
        </p>
        <table className="data-table compact ccop-factor-summary-table">
          <thead>
            <tr>
              <th>Factor</th>
              <th>Element</th>
              <th>P</th>
              <th>Combination</th>
            </tr>
          </thead>
          <tbody>
            {factorSummary.map((row) => (
              <tr key={row.element}>
                <td>
                  <strong>{row.factor}</strong>
                </td>
                <td>{row.element}</td>
                <td>{formatP(row.p, 2)}</td>
                <td className="muted">{row.formula ?? '—'}</td>
              </tr>
            ))}
            <tr className="ccop-factor-summary-pg">
              <td colSpan={2}>
                <strong>Overall Pg</strong>
              </td>
              <td>
                <strong>{formatP(overallPg, 4)}</strong>
              </td>
              <td className="muted">{(overallPg * 100).toFixed(2)}%</td>
            </tr>
          </tbody>
        </table>
        {pgMismatch && (
          <p className="alert warn" role="status" style={{ marginTop: '0.75rem' }}>
            Passed Pg ({formatP(pg!, 4)}) differs from factor product ({formatP(overallPg, 4)}).
            Overall Pg in this table is always the product of the four factors above.
          </p>
        )}
      </section>

      <section className="ccop-risk-review-section">
        <h4>Element breakdown &amp; rationale</h4>
        {!hasComments && (
          <p className="muted convention-inline">
            Add rationale notes under each risk element on the Chance tab to document why each P
            was chosen.
          </p>
        )}
        <table className="data-table compact ccop-risk-review-table">
          <thead>
            <tr>
              <th>Element</th>
              <th>Factor</th>
              <th>P</th>
              <th>Prospect rationale</th>
            </tr>
          </thead>
          <tbody>
            {detailGroups.map(({ group, rows: groupRows }) => (
              <Fragment key={group}>
                <tr className="ccop-risk-review-group-header">
                  <td colSpan={4}>{group}</td>
                </tr>
                {groupRows.map((row, i) => (
                  <tr key={`${group}-${row.element}-${row.label}-${i}`}>
                    <td>{row.element}</td>
                    <td>
                      {row.label}
                      {row.note ? (
                        <span className="muted ccop-risk-review-note"> ({row.note})</span>
                      ) : null}
                    </td>
                    <td>{formatP(row.p, 2)}</td>
                    <td className="ccop-risk-review-comment">{row.comment || '—'}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
