import { useEffect, useMemo, useState } from 'react'
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
import type { PetrelCumulativeRunResult } from '../../types/api'
import {
  buildExceedance,
  buildHistogram,
  percentileMarkersFromSummary,
  percentileProfileFromSummary,
  type HistogramBin,
} from '../../utils/chartData'
import {
  buildPetrelChartSeries,
  defaultPetrelChartKey,
  petrelSummaryToPercentileSummary,
} from '../../utils/petrelCumulativeCharts'

interface PetrelCumulativeChartsProps {
  result: PetrelCumulativeRunResult
}

export function PetrelCumulativeCharts({ result }: PetrelCumulativeChartsProps) {
  const seriesList = useMemo(() => buildPetrelChartSeries(result), [result])
  const [activeKey, setActiveKey] = useState(() => defaultPetrelChartKey(seriesList))

  useEffect(() => {
    if (!seriesList.length) return
    if (!seriesList.some((s) => s.key === activeKey)) {
      setActiveKey(defaultPetrelChartKey(seriesList))
    }
  }, [seriesList, activeKey])

  const active = seriesList.find((s) => s.key === activeKey) ?? seriesList[0]
  const values = active?.values ?? []
  const unit = active?.summary.unit ?? result.gas_unit

  const histogram = useMemo(() => buildHistogram(values), [values])
  const exceedance = useMemo(() => buildExceedance(values), [values])
  const chartSummary = active
    ? petrelSummaryToPercentileSummary(active.summary, active.label)
    : null
  const profile = chartSummary ? percentileProfileFromSummary(chartSummary) : []
  const markers = chartSummary ? percentileMarkersFromSummary(chartSummary) : []
  const percentileScatter = profile.map((p) => ({ rank: p.label, value: p.value }))

  if (!seriesList.length) {
    return (
      <div className="alert warn">
        No iteration arrays in this run. Re-run Petrel cumulative simulation from{' '}
        <strong>Output → Simulation</strong> (arrays are included automatically).
      </div>
    )
  }

  const resolvedKey = active?.key ?? seriesList[0].key

  return (
    <div className="chart-section">
      <label className="chart-select-row">
        GIIP output
        <select
          value={resolvedKey}
          onChange={(e) => setActiveKey(e.target.value)}
        >
          {seriesList.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label} ({s.summary.unit})
            </option>
          ))}
        </select>
      </label>

      <div className="chart-grid">
        <div className="chart-card">
          <h3>Distribution histogram</h3>
          <p className="chart-caption">
            {active?.label} — {result.n_iterations.toLocaleString()} iterations
          </p>
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
                    ? `${row.binStart.toPrecision(4)} – ${row.binEnd.toPrecision(4)} ${unit}`
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
                labelFormatter={(v) => `${active?.label}: ${Number(v).toPrecision(4)} ${unit}`}
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
          <h3>Percentile profile</h3>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={percentileScatter} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e6ed" />
              <XAxis dataKey="rank" />
              <YAxis label={{ value: unit, angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(3) : String(v ?? ''))} />
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
              <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(3) : String(v ?? ''))} />
              <Bar dataKey="value" fill="#1e6bb8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
