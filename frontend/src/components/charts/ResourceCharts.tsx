import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ARRAY_LABELS,
  RESOURCE_ARRAY_KEYS,
  type ResourceArrayKey,
} from '../../constants/chartVariables'
import type { PercentileSummary, SimulationArrays } from '../../types/api'
import {
  buildExceedance,
  buildHistogram,
  type HistogramBin,
  percentileMarkersFromSummary,
  percentileProfileFromSummary,
} from '../../utils/chartData'

interface ResourceChartsProps {
  arrays: SimulationArrays
  summaries: Partial<Record<string, PercentileSummary | null | undefined>>
  /** e.g. "Prospect total" or "R4-S1 — Reservoir4 – Zone 1" */
  scopeLabel?: string
}

function summaryForKey(
  key: ResourceArrayKey,
  summaries: ResourceChartsProps['summaries'],
): PercentileSummary | undefined {
  switch (key) {
    case 'total_mmboe':
      return summaries.total_mmboe ?? undefined
    case 'recoverable_oil_mmbbl':
      return summaries.recoverable_oil ?? undefined
    case 'stoiip_mmbbl':
      return summaries.stoiip ?? undefined
    case 'solution_gas_bcf':
      return summaries.solution_gas ?? undefined
    case 'recoverable_gas_bcf':
      return summaries.recoverable_gas ?? undefined
    case 'giip_bcf':
      return summaries.giip ?? undefined
    case 'condensate_mmbbl':
      return summaries.condensate ?? undefined
    default:
      return undefined
  }
}

export function ResourceCharts({ arrays, summaries, scopeLabel }: ResourceChartsProps) {
  const available = RESOURCE_ARRAY_KEYS.filter((k) => arrays[k]?.length)
  const [product, setProduct] = useState<ResourceArrayKey>(
    available[0] ?? 'total_mmboe',
  )
  const active = available.includes(product) ? product : available[0]
  const values = active ? (arrays[active] ?? []) : []
  const summary = active ? summaryForKey(active, summaries) : undefined

  const histogram = useMemo(() => buildHistogram(values), [values])
  const exceedance = useMemo(() => buildExceedance(values), [values])
  const profile = summary ? percentileProfileFromSummary(summary) : []
  const percentileScatter = profile.map((p) => ({
    rank: p.label,
    value: p.value,
  }))
  const markers = summary ? percentileMarkersFromSummary(summary) : []

  if (!available.length) {
    return <p className="convention-inline">No resource arrays in simulation result.</p>
  }

  const yLabel = ARRAY_LABELS[active] ?? active

  return (
    <div className="chart-section">
      {scopeLabel ? (
        <p className="convention-inline chart-scope-caption">
          Showing: <strong>{scopeLabel}</strong>
        </p>
      ) : null}
      <label className="chart-select-row">
        Resource output
        <select
          value={active}
          onChange={(e) => setProduct(e.target.value as ResourceArrayKey)}
        >
          {available.map((k) => (
            <option key={k} value={k}>
              {ARRAY_LABELS[k] ?? k}
            </option>
          ))}
        </select>
      </label>

      <div className="chart-grid">
        <div className="chart-card">
          <h3>Distribution histogram</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={histogram} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e6ed" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
              <Tooltip
                formatter={(v) => (typeof v === 'number' ? v : String(v))}
                labelFormatter={(_, p) => {
                  const row = p?.[0]?.payload as HistogramBin | undefined
                  return row
                    ? `${row.binStart.toPrecision(4)} – ${row.binEnd.toPrecision(4)}`
                    : ''
                }}
              />
              <Bar dataKey="count" fill="#1e6bb8" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Exceedance curve</h3>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={exceedance} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e6ed" />
              <XAxis
                dataKey="value"
                type="number"
                domain={['auto', 'auto']}
                tickFormatter={(v) => Number(v).toPrecision(3)}
              />
              <YAxis
                domain={[0, 1]}
                label={{ value: 'Exceedance prob.', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                formatter={(v) =>
                  typeof v === 'number' ? v.toFixed(4) : String(v ?? '')
                }
                labelFormatter={(v) => `${yLabel}: ${Number(v).toPrecision(4)}`}
              />
              <Line
                type="monotone"
                dataKey="exceedance"
                stroke="#1e6bb8"
                dot={false}
                strokeWidth={2}
              />
              {markers.map((m) => (
                <ReferenceLine
                  key={m.key}
                  x={m.value}
                  stroke="#c45c26"
                  strokeDasharray="4 4"
                  label={{ value: m.key, position: 'top', fontSize: 11 }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Percentile profile (P99 → P01)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={percentileScatter} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e6ed" />
              <XAxis dataKey="rank" />
              <YAxis label={{ value: yLabel, angle: -90, position: 'insideLeft' }} />
              <Tooltip
                formatter={(v) =>
                  typeof v === 'number' ? v.toFixed(3) : String(v ?? '')
                }
              />
              <Line type="monotone" dataKey="value" stroke="#2d8a4e" strokeWidth={2} />
              <Scatter dataKey="value" fill="#1e6bb8" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Percentile bar chart</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={profile} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e6ed" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip
                formatter={(v) =>
                  typeof v === 'number' ? v.toFixed(3) : String(v ?? '')
                }
              />
              <Bar dataKey="value" fill="#1e6bb8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
