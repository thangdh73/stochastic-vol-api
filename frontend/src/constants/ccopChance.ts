/** CCOP (2000) descriptor lookup – Fig. 3.7 general probability scale */

export type CcopDescriptorId =
  | 'certain'
  | 'most_probable'
  | 'probable'
  | 'possible'
  | 'unlikely'
  | 'impossible'

export interface CcopDescriptor {
  id: CcopDescriptorId
  label: string
  p: number
  pRange: string
}

export const CCOP_DESCRIPTORS: CcopDescriptor[] = [
  {
    id: 'certain',
    label: 'Virtually to absolutely certain (excellent data)',
    p: 1.0,
    pRange: '0.95–1.00',
  },
  {
    id: 'most_probable',
    label: 'Most probable (good data, likely interpretation)',
    p: 0.8,
    pRange: '0.65–0.95',
  },
  {
    id: 'probable',
    label: 'Probable (fair data control)',
    p: 0.6,
    pRange: '0.40–0.65',
  },
  {
    id: 'possible',
    label: 'Possible (poor–fair data, less favourable interpretation)',
    p: 0.3,
    pRange: '0.05–0.35',
  },
  {
    id: 'unlikely',
    label: 'Unlikely (unfavourable models likely)',
    p: 0.1,
    pRange: '0.00–0.05',
  },
  {
    id: 'impossible',
    label: 'Virtually to absolutely impossible',
    p: 0.0,
    pRange: '0.00',
  },
]

export type RiskModel = 'legacy' | 'ccop_v1'

/** Keys for per-element rationale notes (rolled up in Pg risk review). */
export type CcopRiskCommentKey =
  | 'reservoir_presence'
  | 'reservoir_effectiveness'
  | 'trap_structure'
  | 'seal_top'
  | 'seal_lateral'
  | 'source_a'
  | 'source_b'
  | 'source_combined'
  | 'migration'
  | 'retention'

export interface CcopRiskReviewRow {
  group: string
  element: string
  label: string
  p: number
  comment: string
  note?: string
}

/** Top-level CCOP factor (P1–P4) for summary table. */
export interface CcopFactorSummaryRow {
  factor: string
  element: string
  p: number
  formula?: string
}

export const CCOP_FACTOR_GROUPS = [
  'Reservoir (P1)',
  'Trap (P2)',
  'Charge (P3)',
  'Retention (P4)',
] as const

/** Combined P1/P2/P3 rows (exclude from element breakdown). */
export function isCcopCombinedFactorRow(row: CcopRiskReviewRow): boolean {
  return Boolean(row.note) && ['P1', 'P2', 'P3'].includes(row.element)
}

/** Four-factor summary: Reservoir, Trap, Charge, Retention. */
export function extractCcopFactorSummary(rows: CcopRiskReviewRow[]): CcopFactorSummaryRow[] {
  const labels: Record<string, string> = {
    P1: 'Reservoir',
    P2: 'Trap',
    P3: 'Charge',
    P4: 'Retention',
  }
  const summary: CcopFactorSummaryRow[] = []

  for (const el of ['P1', 'P2', 'P3'] as const) {
    const row = rows.find((r) => r.element === el && r.note)
    if (row) {
      summary.push({
        factor: labels[el],
        element: el,
        p: row.p,
        formula: row.note,
      })
    }
  }

  const retention = rows.find((r) => r.group.includes('Retention') && r.element === 'P4')
  if (retention) {
    summary.push({ factor: 'Retention', element: 'P4', p: retention.p })
  }

  return summary
}

/** Element-level rows grouped under each CCOP factor. */
export function groupCcopDetailRows(
  rows: CcopRiskReviewRow[],
): { group: string; rows: CcopRiskReviewRow[] }[] {
  const detail = rows.filter((r) => !isCcopCombinedFactorRow(r))
  return CCOP_FACTOR_GROUPS.map((group) => ({
    group,
    rows: detail.filter((r) => r.group === group),
  })).filter((g) => g.rows.length > 0)
}

export interface CcopRiskSpec {
  reservoir: {
    facies_presence: number
    effectiveness: number
  }
  trap: {
    structure: number
    seal_top?: number | null
    seal_lateral?: number | null
  }
  charge: {
    sources: number[]
    source_combination: 'or' | 'and'
    migration: number
  }
  retention: number
  /** Prospect-specific rationale per risk element (LEAP-style notes). */
  comments?: Partial<Record<CcopRiskCommentKey, string>>
}

/** Default CCOP structure (Tiram FB4–like starter). */
export function defaultCcopRisk(): CcopRiskSpec {
  return {
    reservoir: { facies_presence: 0.8, effectiveness: 1.0 },
    trap: { structure: 1.0, seal_top: 1.0, seal_lateral: 0.3 },
    charge: { sources: [1.0], source_combination: 'or', migration: 1.0 },
    retention: 1.0,
  }
}

export function pFromDescriptor(id: CcopDescriptorId): number {
  const row = CCOP_DESCRIPTORS.find((d) => d.id === id)
  return row?.p ?? 0.7
}

function combineSources(sources: number[], mode: 'or' | 'and'): number {
  if (!sources.length) return 0
  if (mode === 'and') {
    return sources.reduce((acc, s) => acc * s, 1)
  }
  return sources.reduce((acc, s) => 1 - (1 - acc) * (1 - s), 0)
}

/** Pg from factor summary rows (full precision). */
export function ccopPgFromFactorSummary(rows: CcopFactorSummaryRow[]): number {
  if (!rows.length) return 0
  return rows.reduce((acc, row) => acc * row.p, 1)
}

/** Pg from full risk review rows (uses combined P1–P3 + retention P4). */
export function ccopPgFromReviewRows(rows: CcopRiskReviewRow[]): number {
  return ccopPgFromFactorSummary(extractCcopFactorSummary(rows))
}

/** Build Pg risk review table (mirrors engine build_ccop_risk_review). */
export function buildCcopRiskReview(risk: CcopRiskSpec): CcopRiskReviewRow[] {
  const comments = risk.comments ?? {}
  const c = (key: CcopRiskCommentKey) => (comments[key] ?? '').trim()

  const row = (
    group: string,
    element: string,
    label: string,
    p: number,
    commentKey: CcopRiskCommentKey,
    note = '',
  ): CcopRiskReviewRow => ({
    group,
    element,
    label,
    p,
    comment: c(commentKey),
    note,
  })

  const rows: CcopRiskReviewRow[] = []

  rows.push(
    row('Reservoir (P1)', 'P1a', 'Facies presence', risk.reservoir.facies_presence, 'reservoir_presence'),
  )
  rows.push(
    row(
      'Reservoir (P1)',
      'P1b',
      'Reservoir effectiveness',
      risk.reservoir.effectiveness,
      'reservoir_effectiveness',
    ),
  )
  const pRes = risk.reservoir.facies_presence * risk.reservoir.effectiveness
  rows.push({
    group: 'Reservoir (P1)',
    element: 'P1',
    label: 'Combined reservoir',
    p: pRes,
    comment: '',
    note: 'P1a × P1b',
  })

  rows.push(row('Trap (P2)', 'P2a', 'Structure / closure', risk.trap.structure, 'trap_structure'))
  if (risk.trap.seal_top != null && !Number.isNaN(risk.trap.seal_top)) {
    rows.push(row('Trap (P2)', 'P2b', 'Top seal', risk.trap.seal_top, 'seal_top'))
  }
  if (risk.trap.seal_lateral != null && !Number.isNaN(risk.trap.seal_lateral)) {
    rows.push(
      row('Trap (P2)', 'P2b', 'Lateral (fault) seal', risk.trap.seal_lateral, 'seal_lateral'),
    )
  }
  const seals = [risk.trap.seal_top, risk.trap.seal_lateral].filter(
    (v): v is number => v != null && !Number.isNaN(v),
  )
  const pSeal = seals.length ? Math.min(...seals) : 1
  const pTrap = risk.trap.structure * pSeal
  rows.push({
    group: 'Trap (P2)',
    element: 'P2',
    label: 'Combined trap',
    p: pTrap,
    comment: '',
    note: seals.length > 1 ? 'P2a × P2b (seal = min top, lateral)' : 'P2a × P2b',
  })

  const srcPs = risk.charge.sources
  let pSrc: number
  if (srcPs.length > 1) {
    rows.push(row('Charge (P3)', 'P3a', 'Source A', srcPs[0], 'source_a'))
    rows.push(row('Charge (P3)', 'P3a', 'Source B', srcPs[1], 'source_b'))
    pSrc = combineSources(srcPs, risk.charge.source_combination)
    rows.push({
      group: 'Charge (P3)',
      element: 'P3a',
      label: 'Combined source',
      p: pSrc,
      comment: c('source_combined'),
      note: `${risk.charge.source_combination.toUpperCase()} combination`,
    })
  } else if (srcPs.length === 1) {
    rows.push(row('Charge (P3)', 'P3a', 'Mature source', srcPs[0], 'source_a'))
    pSrc = srcPs[0]
  } else {
    pSrc = 0
  }

  rows.push(row('Charge (P3)', 'P3b', 'Migration & timing', risk.charge.migration, 'migration'))
  rows.push({
    group: 'Charge (P3)',
    element: 'P3',
    label: 'Combined charge',
    p: pSrc * risk.charge.migration,
    comment: '',
    note: 'P3a × P3b',
  })

  rows.push(
    row('Retention (P4)', 'P4', 'Retention after accumulation', risk.retention, 'retention'),
  )

  return rows
}

/** Pg = P1 × P2 × P3 × P4 (client-side preview; engine is authoritative). */
export function previewCcopPg(risk: CcopRiskSpec): number {
  const pRes = risk.reservoir.facies_presence * risk.reservoir.effectiveness
  const seals = [risk.trap.seal_top, risk.trap.seal_lateral].filter(
    (v): v is number => v != null && !Number.isNaN(v),
  )
  const pSeal = seals.length ? Math.min(...seals) : 1
  const pTrap = risk.trap.structure * pSeal
  const pSrc = combineSources(risk.charge.sources, risk.charge.source_combination)
  const pCharge = pSrc * risk.charge.migration
  return pRes * pTrap * pCharge * risk.retention
}
