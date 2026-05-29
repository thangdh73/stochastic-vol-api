import type { DistributionSpec } from '../types/api'

function fmt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 })
}

/** One-line P90 / P50 / P10 or fixed value for tables and collapsed editors. */
export function formatDistShort(dist: DistributionSpec | null | undefined): string {
  if (!dist) return '—'
  if (dist.distribution_type === 'fixed') {
    return `fixed ${fmt(dist.fixed_value)}`
  }
  return `${fmt(dist.p90)} / ${fmt(dist.p50)} / ${fmt(dist.p10)}`
}

export function formatDistTypeLabel(dist: DistributionSpec | null | undefined): string {
  if (!dist?.distribution_type) return ''
  const t = dist.distribution_type
  if (t === 'fixed') return 'Fixed'
  if (t === 'lognormal') return 'Lognormal'
  if (t === 'pert') return 'PERT'
  if (t === 'uniform') return 'Uniform'
  return t
}

export function formatDistTypeShort(dist: DistributionSpec | null | undefined): string {
  if (!dist?.distribution_type) return '—'
  const t = dist.distribution_type
  let base: string
  if (t === 'fixed') base = 'Fix'
  else if (t === 'lognormal') base = 'Ln'
  else if (t === 'pert') base = 'PERT'
  else if (t === 'uniform') base = 'Unf'
  else if (t === 'normal') base = 'N'
  else if (t === 'triangular') base = 'Tri'
  else if (t === 'beta') base = 'Beta'
  else base = t.slice(0, 4)
  if (dist.skew_enabled && (t === 'lognormal' || t === 'normal' || t === 'beta')) {
    return `${base}+Sk`
  }
  return base
}

/** QC cell: L=P90, B=P50, H=P10 (or fixed value in B). */
export function formatQcPercentile(
  dist: DistributionSpec | null | undefined,
  which: 'L' | 'B' | 'H',
  asPercent = false,
): string {
  if (!dist) return '—'
  if (dist.distribution_type === 'fixed') {
    if (which !== 'B') return '—'
    const v = dist.fixed_value
    if (v == null || !Number.isFinite(v)) return '—'
    if (asPercent) return (v * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })
    return fmt(v)
  }
  const field = which === 'L' ? dist.p90 : which === 'B' ? dist.p50 : dist.p10
  if (field == null || !Number.isFinite(field)) return '—'
  if (asPercent) return (field * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })
  return fmt(field)
}
