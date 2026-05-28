import { useMemo } from 'react'
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function MarkerShape(props: {
  cx?: number
  cy?: number
  payload?: { key: string; fill: string }
}) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null || !payload) return null
  const r = payload.key === 'P50' ? 7 : 6
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={payload.fill}
      stroke="#333"
      strokeWidth={1}
    />
  )
}
import { acresToSqKm } from '../../constants/units'
import type { SimulationArrays } from '../../types/api'
import {
  buildCumulativeCurve,
  computePercentiles,
  CUMULATIVE_PROB_TICKS,
} from '../../utils/percentiles'

export type AreaChartUnit = 'sq_km' | 'acres'

interface AreaWorkbookChartsProps {
  arrays: SimulationArrays
  displayUnit: AreaChartUnit
}

function convertAreaValues(values: number[], unit: AreaChartUnit): number[] {
  if (unit === 'sq_km') return values.map(acresToSqKm)
  return values
}

function unitLabel(unit: AreaChartUnit): string {
  return unit === 'sq_km' ? 'sq km' : 'acres'
}

function isNearlyConstant(values: number[]): boolean {
  if (values.length < 2) return true
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min <= 0) return max - min < 1e-9
  return max / min < 1.001
}

function probTickLabel(p: number): string {
  const tick = CUMULATIVE_PROB_TICKS.find((t) => Math.abs(t.p - p) < 0.006)
  return tick?.label ?? ''
}

function formatArea(v: number, unit: AreaChartUnit): string {
  if (unit === 'sq_km') return v < 10 ? v.toFixed(3) : v.toFixed(2)
  return v < 1000 ? v.toFixed(1) : v.toFixed(0)
}

interface RangeRow {
  key: string
  label: string
  p99: number
  p01: number
  color: string
}

export function AreaWorkbookCharts({ arrays, displayUnit }: AreaWorkbookChartsProps) {
  const closed = arrays.area ?? []
  const productive = arrays.productive_area ?? []
  const pctFill = arrays.percent_fill ?? []

  const closedDisplay = useMemo(
    () => convertAreaValues(closed, displayUnit),
    [closed, displayUnit],
  )
  const prodDisplay = useMemo(
    () => convertAreaValues(productive, displayUnit),
    [productive, displayUnit],
  )

  const unit = unitLabel(displayUnit)
  const prodConstant = isNearlyConstant(prodDisplay)
  const closedConstant = isNearlyConstant(closedDisplay)

  const curve = useMemo(() => {
    const raw = buildCumulativeCurve(prodDisplay).filter((p) => p.value > 0)
    if (prodConstant && raw.length) {
      const v = raw[0].value
      return CUMULATIVE_PROB_TICKS.map((t) => ({ value: v, cumulative: t.p }))
    }
    return raw
  }, [prodDisplay, prodConstant])

  const prodPct = useMemo(() => computePercentiles(prodDisplay), [prodDisplay])
  const closedPct = useMemo(() => computePercentiles(closedDisplay), [closedDisplay])

  const meanFill = useMemo(() => {
    if (!pctFill.length) return null
    return pctFill.reduce((a, b) => a + b, 0) / pctFill.length
  }, [pctFill])

  const markerDots = useMemo(
    () => [
      { key: 'P50', value: prodPct.p50, cumulative: 0.5, fill: '#e8a0c8' },
      { key: 'P90', value: prodPct.p90, cumulative: 0.1, fill: '#e8d44d' },
      { key: 'P10', value: prodPct.p10, cumulative: 0.9, fill: '#e8d44d' },
    ],
    [prodPct],
  )

  const rangeRows: RangeRow[] = useMemo(() => {
    const rows: RangeRow[] = []
    if (prodDisplay.length) {
      rows.push({
        key: 'prod',
        label: 'Productive Area P99 to P01',
        p99: prodPct.p99,
        p01: prodPct.p01,
        color: '#1a1a1a',
      })
    }
    if (closedDisplay.length) {
      rows.push({
        key: 'closed',
        label: 'Closed Area',
        p99: closedPct.p99,
        p01: closedPct.p01,
        color: '#c03030',
      })
    }
    return rows
  }, [prodDisplay.length, closedDisplay.length, prodPct, closedPct])

  const rangeMin = useMemo(() => {
    const vals = rangeRows.flatMap((r) => [r.p99, r.p01])
    if (!vals.length) return 0
    const lo = Math.min(...vals)
    const hi = Math.max(...vals)
    if (Math.abs(hi - lo) < 1e-9) return lo * 0.85 || 0
    return lo * 0.95
  }, [rangeRows])

  const rangeMax = useMemo(() => {
    const vals = rangeRows.flatMap((r) => [r.p99, r.p01])
    if (!vals.length) return 1
    const lo = Math.min(...vals)
    const hi = Math.max(...vals)
    if (Math.abs(hi - lo) < 1e-9) return hi * 1.15 || 1
    return hi * 1.05
  }, [rangeRows])

  const useLogX = !prodConstant && prodDisplay.every((v) => v > 0)

  if (!prodDisplay.length && !closedDisplay.length) {
    return (
      <p className="convention-inline">
        No area sample arrays in this simulation result.
      </p>
    )
  }

  return (
    <div className="area-workbook-charts">
      {(prodConstant || closedConstant) && (
        <p className="alert info">
          Area or productive area is nearly fixed in this case (e.g. PM3X-D closed
          area = 824 acres). Charts show a single value; use a probabilistic area
          distribution to see full cumulative and range plots.
        </p>
      )}

      <div className="chart-card area-cdf-card">
        <h3 className="area-chart-title">Productive Area</h3>
        <p className="chart-caption">
          Cumulative probability — {unit} ({useLogX ? 'log' : 'linear'} scale)
        </p>
        {curve.length === 0 ? (
          <p className="convention-inline">No positive values to plot.</p>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={curve} margin={{ top: 28, right: 24, left: 56, bottom: 36 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d0d8e0" />
              <XAxis
                dataKey="value"
                type="number"
                scale={useLogX ? 'log' : 'linear'}
                domain={['auto', 'auto']}
                allowDataOverflow={useLogX}
                tickFormatter={(v) => formatArea(Number(v), displayUnit)}
                label={{
                  value: unit,
                  position: 'insideBottom',
                  offset: -4,
                  fontSize: 12,
                }}
              />
              <YAxis
                type="number"
                domain={[0, 1]}
                reversed
                ticks={CUMULATIVE_PROB_TICKS.map((t) => t.p)}
                tickFormatter={probTickLabel}
                label={{
                  value: 'Cumulative Probability →',
                  angle: -90,
                  position: 'insideLeft',
                  fontSize: 11,
                }}
              />
              <Tooltip
                formatter={(v) =>
                  typeof v === 'number' ? Number(v).toPrecision(4) : String(v ?? '')
                }
                labelFormatter={(v) => `${unit}: ${formatArea(Number(v), displayUnit)}`}
              />
              <Line
                type={prodConstant ? 'linear' : 'monotone'}
                dataKey="cumulative"
                stroke="#c03030"
                strokeDasharray="6 4"
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Scatter
                data={markerDots}
                dataKey="cumulative"
                name="Percentiles"
                shape={MarkerShape}
                isAnimationActive={false}
                legendType="none"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="chart-card area-range-card">
        <h3>Area ranges ({unit})</h3>
        <p className="chart-caption">
          P99–P01 bars, closed area, productive mean (purple), percent fill (blue)
        </p>
        <div className="area-range-plot">
          <div className="area-range-axis">
            {Array.from({ length: 7 }, (_, i) => {
              const v = rangeMin + ((rangeMax - rangeMin) * i) / 6
              return (
                <span key={i} style={{ left: `${(i / 6) * 100}%` }}>
                  {formatArea(v, displayUnit)}
                </span>
              )
            })}
          </div>
          <div className="area-range-tracks">
            {rangeRows.map((row) => {
              const span = rangeMax - rangeMin || 1
              let left = ((row.p99 - rangeMin) / span) * 100
              let width = ((row.p01 - row.p99) / span) * 100
              if (width < 0.8) {
                width = 0.8
                left = ((row.p99 + row.p01) / 2 - rangeMin) / span * 100 - width / 2
              }
              return (
                <div className="area-range-row" key={row.key}>
                  <span className="area-range-label">{row.label}</span>
                  <div className="area-range-track">
                    <div
                      className="area-range-bar"
                      style={{
                        left: `${Math.max(0, Math.min(99, left))}%`,
                        width: `${width}%`,
                        backgroundColor: row.color,
                      }}
                      title={`P99=${formatArea(row.p99, displayUnit)} P01=${formatArea(row.p01, displayUnit)} ${unit}`}
                    />
                  </div>
                </div>
              )
            })}
            {prodDisplay.length > 0 && (
              <div className="area-range-row area-range-mean-row">
                <span className="area-range-label">Productive Area Mean</span>
                <div className="area-range-track">
                  <div
                    className="area-range-mean-line"
                    style={{
                      left: `${((prodPct.mean - rangeMin) / (rangeMax - rangeMin || 1)) * 100}%`,
                    }}
                    title={`Mean: ${formatArea(prodPct.mean, displayUnit)} ${unit}`}
                  />
                  {meanFill != null && (
                    <div
                      className="area-range-fill-marker"
                      title={`Mean percent fill: ${(meanFill * 100).toFixed(1)}%`}
                      style={{
                        left: `${((prodPct.mean - rangeMin) / (rangeMax - rangeMin || 1)) * 100}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="area-range-x-label">{unit}</div>
        </div>
        <ul className="area-range-legend">
          <li>
            <span className="swatch" style={{ background: '#1a1a1a' }} /> Productive
            area P99–P01
          </li>
          <li>
            <span className="swatch" style={{ background: '#c03030' }} /> Closed area
          </li>
          <li>
            <span className="swatch mean" /> Mean productive area
          </li>
          <li>
            <span className="swatch fill" /> Percent fill
          </li>
        </ul>
      </div>
    </div>
  )
}
