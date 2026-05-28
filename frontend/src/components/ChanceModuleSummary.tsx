import {
  buildCcopRiskReview,
  previewCcopPg,
  type CcopRiskReviewRow,
  type CcopRiskSpec,
} from '../constants/ccopChance'
import type { ModulePreviewResponse } from '../types/api'
import { CcopPgRiskReview } from './CcopPgRiskReview'

interface ChancePgSummary {
  pg?: number
  category_chances?: Record<string, number>
  pg_risked_mean?: number
  resource_unit?: string
  risk_review?: CcopRiskReviewRow[]
}

interface ChanceModuleSummaryProps {
  preview: ModulePreviewResponse
  variant: 'ccop' | 'legacy'
  /** Current CCOP inputs — used if the API response omits risk_review (stale API / unsaved state). */
  ccopRisk?: CcopRiskSpec | null
}

const LEGACY_LABELS: Record<string, string> = {
  source: 'Source',
  timing_migration: 'Timing / Migration',
  reservoir: 'Reservoir',
  closure: 'Closure',
  containment: 'Containment',
}

export function ChanceModuleSummary({ preview, variant, ccopRisk }: ChanceModuleSummaryProps) {
  const pg = preview.summaries.pg as ChancePgSummary | undefined
  const metaPg = preview.metadata.pg as number | undefined
  const metaReview = preview.metadata.risk_review as CcopRiskReviewRow[] | undefined

  if (variant === 'ccop') {
    let riskReview = pg?.risk_review ?? metaReview
    let simPg = pg?.pg ?? metaPg

    if (ccopRisk) {
      if (!riskReview?.length) {
        riskReview = buildCcopRiskReview(ccopRisk)
      }
      if (simPg == null) {
        simPg = previewCcopPg(ccopRisk)
      }
    }

    if (!riskReview?.length && simPg == null) {
      return (
        <p className="convention-inline">
          Click <strong>Run Chance simulation</strong> to compute Pg and build the risk review
          table. If you already ran it, restart the API on port <strong>8002</strong> and try again.
        </p>
      )
    }

    const usedClientFallback = !pg?.risk_review?.length && !metaReview?.length && Boolean(ccopRisk)

    return (
      <div>
        {usedClientFallback && (
          <p className="alert warn" role="status">
            Showing risk review from your current inputs — restart the API and re-run Chance
            simulation to lock the engine result for Monte Carlo.
          </p>
        )}
        <CcopPgRiskReview
          rows={riskReview ?? []}
          pg={simPg}
          title="Pg &amp; risk review"
          subtitle="CCOP factor summary and prospect rationale."
        />
      </div>
    )
  }

  const simPg = pg?.pg ?? metaPg
  const categoryEntries: [string, number][] =
    pg?.category_chances && typeof pg.category_chances === 'object'
      ? Object.entries(pg.category_chances)
      : []

  return (
    <div>
      {simPg != null && (
        <p>
          <strong>Overall Pg:</strong> {(simPg * 100).toFixed(2)}%{' '}
          <span className="muted">(P = {simPg.toFixed(4)})</span>
        </p>
      )}
      {categoryEntries.length > 0 && (
        <ul className="chart-legend-list">
          {categoryEntries.map(([cat, ch]) => (
            <li key={cat}>
              {LEGACY_LABELS[cat] ?? cat}: {(ch * 100).toFixed(1)}%
            </li>
          ))}
        </ul>
      )}
      {pg?.pg_risked_mean != null && (
        <p className="convention-inline">
          Pg × unit unrisked mean (preview): {pg.pg_risked_mean.toFixed(4)}{' '}
          {pg.resource_unit ?? ''}
        </p>
      )}
    </div>
  )
}
