import type { DistributionSpec, SimulationInput } from '../types/api'
import { ensureNrvDistributions } from './defaultInput'
import type { DistKey } from './inputHelpers'
import { patchDistributionPercentile } from './inputHelpers'
import type { HcYieldControlColumn } from './hcYieldControlColumns'
import { buildTankRows, uniqueTankId } from './tankLabels'

export type HcYieldCsvRow = Record<string, string>

export type HcYieldImportResult = {
  updated: number
  skipped: string[]
  errors: string[]
}

const FRACTION_PARAM_KEYS = new Set<DistKey>(['porosity_dist', 'saturation_dist', 'net_to_gross_dist'])

const PARAM_ALIASES: Record<
  string,
  { key: DistKey; which: 'L' | 'B' | 'H' | 'type' }
> = {}

function regParam(key: DistKey, labels: string[], which: 'L' | 'B' | 'H' | 'type') {
  for (const label of labels) {
    PARAM_ALIASES[normalizeHeader(label)] = { key, which }
  }
}

regParam('porosity_dist', ['PORO(L)', 'PORO_L', 'POROL', 'PORO L', 'POROSITY(L)'], 'L')
regParam('porosity_dist', ['PORO(B)', 'PORO_B', 'POROB', 'PORO B', 'POROSITY(B)'], 'B')
regParam('porosity_dist', ['PORO(H)', 'PORO_H', 'POROH', 'PORO H', 'POROSITY(H)'], 'H')
regParam('porosity_dist', ['PORO TYPE', 'PORO_TYPE', 'POROSITY TYPE'], 'type')

regParam('saturation_dist', ['SW(L)', 'SW_L', 'SWL', 'SW L'], 'L')
regParam('saturation_dist', ['SW(B)', 'SW_B', 'SWB', 'SW B'], 'B')
regParam('saturation_dist', ['SW(H)', 'SW_H', 'SWH', 'SW H'], 'H')
regParam('saturation_dist', ['SW TYPE', 'SW_TYPE'], 'type')

regParam('fvf_dist', ['BO(L)', 'BO_L', 'BOL', 'BO L', 'FVF(L)', 'FVF_L', 'FVFL'], 'L')
regParam('fvf_dist', ['BO(B)', 'BO_B', 'BOB', 'BO B', 'FVF(B)', 'FVF_B', 'FVFB'], 'B')
regParam('fvf_dist', ['BO(H)', 'BO_H', 'BOH', 'BO H', 'FVF(H)', 'FVF_H', 'FVFH'], 'H')
regParam('fvf_dist', ['BO TYPE', 'BO_TYPE', 'FVF TYPE', 'FVF_TYPE'], 'type')

regParam('gef_dist', ['GEF(L)', 'GEF_L', 'GEFL'], 'L')
regParam('gef_dist', ['GEF(B)', 'GEF_B', 'GEFB'], 'B')
regParam('gef_dist', ['GEF(H)', 'GEF_H', 'GEFH'], 'H')
regParam('gef_dist', ['GEF TYPE', 'GEF_TYPE'], 'type')

regParam('net_to_gross_dist', ['NTG(L)', 'NTG_L', 'NTGL'], 'L')
regParam('net_to_gross_dist', ['NTG(B)', 'NTG_B', 'NTGB'], 'B')
regParam('net_to_gross_dist', ['NTG(H)', 'NTG_H', 'NTGH'], 'H')
regParam('net_to_gross_dist', ['NTG TYPE', 'NTG_TYPE'], 'type')

function normalizeHeader(h: string): string {
  return h.trim().toUpperCase().replace(/\s+/g, ' ')
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if ((c === ',' && !inQuotes) || c === '\t') {
      out.push(cur.trim())
      cur = ''
      if (c === '\t') continue
    } else {
      cur += c
    }
  }
  out.push(cur.trim())
  return out
}

export function parseDelimitedTable(text: string): HcYieldCsvRow[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0]).map(normalizeHeader)
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const row: HcYieldCsvRow = {}
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? ''
    })
    return row
  })
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

function columnImportHeaders(col: HcYieldControlColumn): string[] {
  const base = col.label.toUpperCase()
  return [`${base}(L)`, `${base}(B)`, `${base}(H)`, `${base} Type`]
}

export function hcYieldCsvTemplateHeaders(columns: HcYieldControlColumn[]): string[] {
  return ['Segment', 'Reservoir', 'Unique ID', ...columns.flatMap(columnImportHeaders)]
}

export function buildHcYieldCsvTemplate(
  columns: HcYieldControlColumn[],
  rows: ReturnType<typeof buildTankRows>,
): string {
  const headers = hcYieldCsvTemplateHeaders(columns)
  const example = rows[0]
  const exampleRow = [
    example?.segmentName ?? 'Segment1',
    example?.reservoirName ?? 'Reservoir1',
    example?.uniqueId ?? 'Segment1,Reservoir1',
    ...columns.flatMap((col) => {
      if (col.key === 'porosity_dist') return ['0.15', '0.20', '0.25', 'beta']
      if (col.key === 'saturation_dist') return ['0.55', '0.65', '0.75', 'beta']
      if (col.key === 'net_to_gross_dist') return ['0.55', '0.75', '0.92', 'lognormal']
      return ['1.1', '1.2', '1.3', 'lognormal']
    }),
  ]
  return [headers.join(','), exampleRow.map(csvEscape).join(',')].join('\n')
}

function distValueForExport(
  dist: DistributionSpec | null | undefined,
  which: 'L' | 'B' | 'H',
): string {
  if (!dist) return ''
  if (dist.distribution_type === 'fixed') {
    if (which !== 'B') return ''
    const v = dist.fixed_value
    if (v == null) return ''
    return String(v)
  }
  const v = which === 'L' ? dist.p90 : which === 'B' ? dist.p50 : dist.p10
  if (v == null) return ''
  return String(v)
}

export function exportHcYieldCsv(
  columns: HcYieldControlColumn[],
  rows: ReturnType<typeof buildTankRows>,
  getTank: (segmentId: string, reservoirId: string) => SimulationInput | null,
  getDist: (tank: SimulationInput, key: DistKey) => DistributionSpec | null,
): string {
  const headers = hcYieldCsvTemplateHeaders(columns)
  const lines = [headers.join(',')]
  for (const row of rows) {
    const tank = getTank(row.segmentId, row.reservoirId)
    const cells = [row.segmentName, row.reservoirName, row.uniqueId]
    for (const col of columns) {
      const dist = tank ? getDist(tank, col.key) : null
      cells.push(
        distValueForExport(dist, 'L'),
        distValueForExport(dist, 'B'),
        distValueForExport(dist, 'H'),
        dist?.distribution_type ?? '',
      )
    }
    lines.push(cells.map(csvEscape).join(','))
  }
  return lines.join('\n')
}

/** Parse decimal text; supports European comma (0,2 → 0.2). */
function parseDecimal(raw: string): number | null {
  const t = raw.trim().replace(/\s+/g, '')
  if (!t) return null
  let normalized = t
  if (/^\d+,\d+$/.test(t) || /^\d*,\d+$/.test(t)) {
    normalized = t.replace(',', '.')
  } else {
    normalized = t.replace(/,/g, '')
  }
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

/**
 * Parse porosity / Sw / other fraction variables from CSV.
 * Accepts fraction (0.2) or percent-style whole numbers (20 → 0.2).
 */
export function parseFractionOrPercent(raw: string): number | null {
  const n = parseDecimal(raw)
  if (n == null) return null
  if (n > 1 && n <= 100) return n / 100
  return n
}

const VALID_DISTRIBUTION_TYPES = new Set([
  'fixed',
  'uniform',
  'normal',
  'lognormal',
  'triangular',
  'beta',
  'pert',
])

function normalizeDistributionType(raw: string): string {
  const t = raw.trim().toLowerCase()
  if (VALID_DISTRIBUTION_TYPES.has(t)) return t
  if (t === 'ln' || t === 'log-normal') return 'lognormal'
  if (t === 'tri') return 'triangular'
  return 'lognormal'
}

function whichToField(which: 'L' | 'B' | 'H'): 'p90' | 'p50' | 'p10' {
  if (which === 'L') return 'p90'
  if (which === 'B') return 'p50'
  return 'p10'
}

export function applyHcYieldCsvRow(
  tank: SimulationInput,
  csvRow: HcYieldCsvRow,
  columns: HcYieldControlColumn[],
): SimulationInput {
  let next = ensureNrvDistributions(tank)
  const allowedKeys = new Set(columns.map((c) => c.key))

  for (const [header, raw] of Object.entries(csvRow)) {
    const spec = PARAM_ALIASES[normalizeHeader(header)]
    if (!spec || !allowedKeys.has(spec.key)) continue
    if (!raw.trim()) continue

    const dist = (next[spec.key] as DistributionSpec | null | undefined) ?? null
    if (!dist) continue

    if (spec.which === 'type') {
      next = {
        ...next,
        [spec.key]: { ...dist, distribution_type: normalizeDistributionType(raw) },
      }
      continue
    }

    const num = FRACTION_PARAM_KEYS.has(spec.key)
      ? parseFractionOrPercent(raw)
      : parseDecimal(raw)
    if (num == null) continue
    const patched = patchDistributionPercentile(dist, whichToField(spec.which), num)
    next = { ...next, [spec.key]: patched }
  }
  return next
}

export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function matchUniqueId(segmentName: string, reservoirName: string): string {
  return uniqueTankId(segmentName, reservoirName)
}
