import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ARRAY_LABELS,
  RECOMMENDED_SCATTER_PAIRS,
} from '../../constants/chartVariables'
import type { SimulationArrays } from '../../types/api'
import { availableArrayKeys, downsampleScatter } from '../../utils/chartData'

interface ScatterChartsProps {
  arrays: SimulationArrays
}

export function ScatterCharts({ arrays }: ScatterChartsProps) {
  const keys = availableArrayKeys(arrays)
  const [xKey, setXKey] = useState(keys[0] ?? 'area')
  const [yKey, setYKey] = useState(keys[1] ?? 'net_pay_ft')

  const points = useMemo(() => {
    const xs = arrays[xKey] ?? []
    const ys = arrays[yKey] ?? []
    return downsampleScatter(xs, ys)
  }, [arrays, xKey, yKey])

  const applyPreset = (x: string, y: string) => {
    if (keys.includes(x) && keys.includes(y)) {
      setXKey(x)
      setYKey(y)
    }
  }

  if (keys.length < 2) {
    return <p className="convention-inline">Need at least two variables for scatter plots.</p>
  }

  return (
    <div className="chart-section">
      <div className="chart-select-row scatter-selects">
        <label>
          X axis
          <select value={xKey} onChange={(e) => setXKey(e.target.value)}>
            {keys.map((k) => (
              <option key={k} value={k}>
                {ARRAY_LABELS[k] ?? k}
              </option>
            ))}
          </select>
        </label>
        <label>
          Y axis
          <select value={yKey} onChange={(e) => setYKey(e.target.value)}>
            {keys.map((k) => (
              <option key={k} value={k}>
                {ARRAY_LABELS[k] ?? k}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="chart-caption">Workbook: Scatter Chart sheet (relationship plots)</p>
      <div className="preset-row">
        {RECOMMENDED_SCATTER_PAIRS.filter(
          (p) => keys.includes(p.x) && keys.includes(p.y),
        ).map((p) => (
          <button
            key={p.label}
            type="button"
            className="btn-secondary"
            onClick={() => applyPreset(p.x, p.y)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="chart-card">
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ top: 12, right: 24, left: 12, bottom: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e6ed" />
            <XAxis
              type="number"
              dataKey="x"
              name={ARRAY_LABELS[xKey] ?? xKey}
              tickFormatter={(v) => Number(v).toPrecision(3)}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={ARRAY_LABELS[yKey] ?? yKey}
              tickFormatter={(v) => Number(v).toPrecision(3)}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(v) =>
                typeof v === 'number' ? v.toPrecision(4) : String(v ?? '')
              }
            />
            <Scatter data={points} fill="#1e6bb8" fillOpacity={0.35} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
