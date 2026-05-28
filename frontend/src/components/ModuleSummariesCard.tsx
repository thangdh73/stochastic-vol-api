import type { RockVolumeInputUnit } from '../constants/inputUnits'
import type { ModulePreviewResponse, PercentileSummary } from '../types/api'
import { summaryForDisplay } from '../utils/displaySummaries'

function isPercentileSummary(v: unknown): v is PercentileSummary {
  return (
    typeof v === 'object' &&
    v !== null &&
    'p90' in v &&
    'p50' in v &&
    'p10' in v
  )
}

interface ModuleSummariesCardProps {
  preview: ModulePreviewResponse
  title?: string
  /** If set, only show these summary keys (e.g. implied_net_pay_ft). */
  keys?: string[]
  /** Convert nrv_acft / grv_acft summaries from canonical acre-ft to this unit. */
  rockVolumeUnit?: RockVolumeInputUnit
}

export function ModuleSummariesCard({
  preview,
  title,
  keys,
  rockVolumeUnit,
}: ModuleSummariesCardProps) {
  const entries = Object.entries(preview.summaries)
    .filter(([k, v]) => isPercentileSummary(v) && (!keys?.length || keys.includes(k)))
    .map(([k, v]) => [k, summaryForDisplay(k, v as PercentileSummary, rockVolumeUnit)] as const)

  if (!entries.length) return null

  return (
    <div className="card">
      <h3>{title ?? `${preview.scope_label} — percentile summary`}</h3>
      <table className="data-table compact">
        <thead>
          <tr>
            <th>Variable</th>
            <th>P90</th>
            <th>P50</th>
            <th>P10</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, s]) => (
            <tr key={key}>
              <td>{s.product_name}</td>
              <td>{formatNum(s.p90)}</td>
              <td>{formatNum(s.p50)}</td>
              <td>{formatNum(s.p10)}</td>
              <td>{s.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 1 })
  if (Math.abs(n) >= 1) return n.toFixed(3)
  return n.toFixed(4)
}
