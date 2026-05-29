import { useMemo } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DistributionSpec, PercentileSummary } from '../../types/api'
import { buildHistogram, type HistogramBin } from '../../utils/chartData'
import { formatDistTypeShort } from '../../utils/distSummary'

type InputMarkers = {
  p90?: number | null
  p50?: number | null
  p10?: number | null
}

type Props = {
  samples: number[]
  summary: PercentileSummary
  dist: DistributionSpec
  inputMarkers?: InputMarkers
  asPercent?: boolean
}

function scale(v: number, asPercent: boolean): number {
  return asPercent ? v * 100 : v
}

function fmt(v: number | null | undefined, asPercent: boolean): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const x = asPercent ? v * 100 : v
  return x.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

export function DistributionHistogramChart({
  samples,
  summary,
  dist,
  inputMarkers,
  asPercent = false,
}: Props) {
  const displaySamples = useMemo(
    () => (asPercent ? samples.map((v) => v * 100) : samples),
    [samples, asPercent],
  )

  const histogram = useMemo(
    () =>
      buildHistogram(displaySamples, 35).map((bin: HistogramBin) => ({
        ...bin,
        mid: (bin.binStart + bin.binEnd) / 2,
      })),
    [displaySamples],
  )

  const inputP90 = inputMarkers?.p90 ?? dist.p90
  const inputP50 = inputMarkers?.p50 ?? dist.p50
  const inputP10 = inputMarkers?.p10 ?? dist.p10

  const markerLines = [
    { key: 'P90', value: scale(inputP90 ?? summary.p90, asPercent), color: '#c53030', dash: undefined },
    { key: 'P50', value: scale(inputP50 ?? summary.p50, asPercent), color: '#c53030', dash: '4 4' },
    { key: 'P10', value: scale(inputP10 ?? summary.p10, asPercent), color: '#c53030', dash: undefined },
  ].filter((m) => Number.isFinite(m.value))

  const unitSuffix = asPercent ? '%' : dist.unit || dist.canonical_unit || ''

  return (
    <div className="dist-qc-chart-wrap">
      <p className="chart-caption">
        {formatDistTypeShort(dist)}
        {dist.skew_enabled ? ' · skew on' : ''}
        {unitSuffix ? ` · ${unitSuffix}` : ''}
        {' · '}
        {displaySamples.length.toLocaleString()} samples
      </p>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={histogram} margin={{ top: 12, right: 20, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e6ed" />
          <XAxis
            dataKey="mid"
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => Number(v).toPrecision(3)}
            label={{
              value: unitSuffix ? `Value (${unitSuffix})` : 'Value',
              position: 'insideBottom',
              offset: -4,
              fontSize: 11,
            }}
          />
          <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
          <Tooltip
            formatter={(v) => (typeof v === 'number' ? v : String(v))}
            labelFormatter={(_, p) => {
              const row = p?.[0]?.payload as { binStart: number; binEnd: number } | undefined
              return row
                ? `${row.binStart.toPrecision(4)} – ${row.binEnd.toPrecision(4)}`
                : ''
            }}
          />
          <Bar dataKey="count" fill="#94a3b8" radius={[2, 2, 0, 0]} />
          {markerLines.map((m) => (
            <ReferenceLine
              key={m.key}
              x={m.value}
              stroke={m.color}
              strokeWidth={2}
              strokeDasharray={m.dash}
              label={{
                value: `${m.key}=${Number(m.value).toPrecision(3)}`,
                position: 'top',
                fill: m.color,
                fontSize: 11,
              }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      <table className="data-table dist-qc-marker-table">
        <thead>
          <tr>
            <th />
            <th>Input</th>
            <th>Sampled</th>
          </tr>
        </thead>
        <tbody>
          {(['P90', 'P50', 'P10'] as const).map((label) => {
            const lk = label.toLowerCase() as 'p90' | 'p50' | 'p10'
            const inputVal = lk === 'p90' ? inputP90 : lk === 'p50' ? inputP50 : inputP10
            const sampledVal = summary[lk]
            return (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{fmt(inputVal, asPercent)}</td>
                <td>{fmt(sampledVal, asPercent)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
