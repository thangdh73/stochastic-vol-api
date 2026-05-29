import type {
  PercentileSummary,
  ReservoirItem,
  ReservoirSegment,
  SimulateResponse,
  SimulationArrays,
  ScopeBreakdownRow,
} from '../types/api'
import { tankCode } from './tankLabels'

export type ChartScopeType = 'prospect' | 'reservoir' | 'segment' | 'tank'

export interface ChartScopeSelection {
  scopeType: ChartScopeType
  scopeId: string
}

export interface ChartScopeOption {
  id: string
  label: string
}

export interface ResolvedChartScope {
  scopeType: ChartScopeType
  scopeId: string
  scopeLabel: string
  arrays: SimulationArrays
  summaries: Partial<Record<string, PercentileSummary | null | undefined>>
}

function tankLabel(
  tankKey: string,
  segmentNameById: Record<string, string>,
  reservoirNameById: Record<string, string>,
  segmentIndexById: Record<string, number>,
  reservoirIndexById: Record<string, number>,
): string {
  const [sid, rid] = tankKey.split('::')
  const segName = segmentNameById[sid] ?? sid
  const resName = reservoirNameById[rid] ?? rid
  const segIdx = segmentIndexById[sid]
  const resIdx = reservoirIndexById[rid]
  const code =
    Number.isFinite(segIdx) && Number.isFinite(resIdx) ? tankCode(resIdx, segIdx) : null
  return code ? `${code} — ${resName} – ${segName}` : `${resName} – ${segName}`
}

function summariesFromRow(
  row: ScopeBreakdownRow,
): Partial<Record<string, PercentileSummary | null | undefined>> {
  return row.summaries
}

function summariesFromResult(
  simulation: SimulateResponse,
): Partial<Record<string, PercentileSummary | null | undefined>> {
  const r = simulation.result
  return {
    total_mmboe: r.total_mmboe,
    recoverable_oil: r.recoverable_oil,
    stoiip: r.stoiip,
    solution_gas: r.solution_gas,
    recoverable_gas: r.recoverable_gas,
    giip: r.giip,
    condensate: r.condensate,
  }
}

function findRow(
  rows: ScopeBreakdownRow[] | undefined,
  id: string,
): ScopeBreakdownRow | undefined {
  return rows?.find((r) => r.id === id)
}

export function buildChartScopeOptions(
  simulation: SimulateResponse | null | undefined,
  segments: ReservoirSegment[],
  reservoirs: ReservoirItem[],
): Record<ChartScopeType, ChartScopeOption[]> {
  const segmentNameById = Object.fromEntries(segments.map((s) => [s.id, s.name]))
  const reservoirNameById = Object.fromEntries(reservoirs.map((r) => [r.id, r.name]))
  const segmentIndexById = Object.fromEntries(segments.map((s, i) => [s.id, i]))
  const reservoirIndexById = Object.fromEntries(reservoirs.map((r, i) => [r.id, i]))

  const breakdown = simulation?.breakdown
  const hasScopeBreakdown = Boolean(breakdown?.tanks?.length)

  const prospect: ChartScopeOption[] = [
    {
      id: 'prospect',
      label: breakdown?.prospect.label ?? simulation?.result.prospect_name ?? 'Prospect total',
    },
  ]

  const reservoirRows = hasScopeBreakdown && breakdown?.reservoirs?.length
    ? breakdown.reservoirs
    : hasScopeBreakdown
      ? reservoirs.map((r) => ({ id: r.id, label: r.name }))
      : []
  const segmentRows = hasScopeBreakdown && breakdown?.segments?.length
    ? breakdown.segments
    : hasScopeBreakdown
      ? segments.map((s) => ({ id: s.id, label: s.name }))
      : []
  const tankRows = hasScopeBreakdown && breakdown?.tanks?.length
    ? breakdown.tanks
    : hasScopeBreakdown
      ? segments.flatMap((s) =>
          reservoirs.map((r) => ({
            id: `${s.id}::${r.id}`,
            label: tankLabel(
              `${s.id}::${r.id}`,
              segmentNameById,
              reservoirNameById,
              segmentIndexById,
              reservoirIndexById,
            ),
          })),
        )
      : []

  return {
    prospect,
    reservoir: reservoirRows.map((r) => ({
      id: r.id,
      label: reservoirNameById[r.id] ?? r.label ?? r.id,
    })),
    segment: segmentRows.map((r) => ({
      id: r.id,
      label: segmentNameById[r.id] ?? r.label ?? r.id,
    })),
    tank: tankRows.map((r) => ({
      id: r.id,
      label:
        'segment_id' in r && 'reservoir_id' in r && r.segment_id && r.reservoir_id
          ? tankLabel(
              r.id,
              segmentNameById,
              reservoirNameById,
              segmentIndexById,
              reservoirIndexById,
            )
          : r.label ?? r.id,
    })),
  }
}

export function resolveChartScope(
  simulation: SimulateResponse | null | undefined,
  selection: ChartScopeSelection,
  segments: ReservoirSegment[],
  reservoirs: ReservoirItem[],
): ResolvedChartScope | null {
  if (!simulation?.result.arrays) return null

  const options = buildChartScopeOptions(simulation, segments, reservoirs)
  const breakdown = simulation.breakdown
  const fallbackArrays = simulation.result.arrays ?? {}
  const fallbackSummaries = summariesFromResult(simulation)

  if (selection.scopeType === 'prospect') {
    const row = breakdown?.prospect
    return {
      scopeType: 'prospect',
      scopeId: 'prospect',
      scopeLabel: options.prospect[0]?.label ?? 'Prospect total',
      arrays: row?.arrays ?? fallbackArrays,
      summaries: row ? summariesFromRow(row) : fallbackSummaries,
    }
  }

  if (selection.scopeType === 'reservoir') {
    const row = findRow(breakdown?.reservoirs, selection.scopeId)
    const label =
      options.reservoir.find((o) => o.id === selection.scopeId)?.label ?? selection.scopeId
    return {
      scopeType: 'reservoir',
      scopeId: selection.scopeId,
      scopeLabel: label,
      arrays: row?.arrays ?? fallbackArrays,
      summaries: row ? summariesFromRow(row) : fallbackSummaries,
    }
  }

  if (selection.scopeType === 'segment') {
    const row = findRow(breakdown?.segments, selection.scopeId)
    const label = options.segment.find((o) => o.id === selection.scopeId)?.label ?? selection.scopeId
    return {
      scopeType: 'segment',
      scopeId: selection.scopeId,
      scopeLabel: label,
      arrays: row?.arrays ?? fallbackArrays,
      summaries: row ? summariesFromRow(row) : fallbackSummaries,
    }
  }

  const row = findRow(breakdown?.tanks, selection.scopeId)
  const label = options.tank.find((o) => o.id === selection.scopeId)?.label ?? selection.scopeId
  return {
    scopeType: 'tank',
    scopeId: selection.scopeId,
    scopeLabel: label,
    arrays: row?.arrays ?? fallbackArrays,
    summaries: row ? summariesFromRow(row) : fallbackSummaries,
  }
}

export function defaultChartScopeSelection(
  simulation: SimulateResponse | null | undefined,
  segments: ReservoirSegment[],
  reservoirs: ReservoirItem[],
): ChartScopeSelection {
  const options = buildChartScopeOptions(simulation, segments, reservoirs)
  if ((options.tank.length ?? 0) > 1) {
    return { scopeType: 'prospect', scopeId: 'prospect' }
  }
  if (options.tank.length === 1) {
    return { scopeType: 'tank', scopeId: options.tank[0].id }
  }
  return { scopeType: 'prospect', scopeId: 'prospect' }
}

/** True when breakdown includes per-scope MC arrays (multi-tank runs after scope filtering shipped). */
export function breakdownHasScopeArrays(simulation: SimulateResponse | null | undefined): boolean {
  const tanks = simulation?.breakdown?.tanks
  if (!tanks?.length) return false
  return tanks.some((t) => t.arrays && Object.keys(t.arrays).length > 0)
}

/** True when the selected scope has its own arrays (not prospect-level fallback). */
export function scopeHasDedicatedArrays(
  simulation: SimulateResponse | null | undefined,
  selection: ChartScopeSelection,
): boolean {
  if (selection.scopeType === 'prospect') return true
  const breakdown = simulation?.breakdown
  if (!breakdown) return false
  const row =
    selection.scopeType === 'reservoir'
      ? findRow(breakdown.reservoirs, selection.scopeId)
      : selection.scopeType === 'segment'
        ? findRow(breakdown.segments, selection.scopeId)
        : findRow(breakdown.tanks, selection.scopeId)
  return Boolean(row?.arrays && Object.keys(row.arrays).length > 0)
}
