import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ARRAY_LABELS, INPUT_QC_ARRAY_KEYS } from '../../constants/chartVariables'
import type { RockVolumeInputUnit } from '../../constants/inputUnits'
import { rockVolumeInputUnitLabel } from '../../constants/inputUnits'
import type { SimulationArrays } from '../../types/api'
import { availableArrayKeys, buildHistogram } from '../../utils/chartData'
import { scaleRockVolumeArray } from '../../utils/displaySummaries'

const ROCK_VOLUME_ARRAY_KEYS = new Set(['grv_acft', 'nrv_acft', 'hcpv_acft'])

interface InputQcChartsProps {
  arrays: SimulationArrays
  rockVolumeUnit?: RockVolumeInputUnit
}

export function InputQcCharts({ arrays, rockVolumeUnit }: InputQcChartsProps) {
  const available = INPUT_QC_ARRAY_KEYS.filter((k) =>
    availableArrayKeys(arrays).includes(k),
  )
  const [variable, setVariable] = useState<string>(available[0] ?? 'porosity')
  const active =
    variable && available.includes(variable as (typeof available)[number])
      ? variable
      : available[0]
  const values = active ? (arrays[active] ?? []) : []
  const displayValues = useMemo(() => {
    if (!active || !ROCK_VOLUME_ARRAY_KEYS.has(active)) return values
    return scaleRockVolumeArray(values, rockVolumeUnit)
  }, [active, values, rockVolumeUnit])
  const histogram = useMemo(() => buildHistogram(displayValues, 35), [displayValues])
  const activeLabel = useMemo(() => {
    const base = ARRAY_LABELS[active] ?? active
    if (!active || !ROCK_VOLUME_ARRAY_KEYS.has(active) || !rockVolumeUnit) return base
    return `${base.split('(')[0].trim()} (${rockVolumeInputUnitLabel(rockVolumeUnit)})`
  }, [active, rockVolumeUnit])

  if (!available.length) {
    return <p className="convention-inline">No input sample arrays available.</p>
  }

  return (
    <div className="chart-section">
      <label className="chart-select-row">
        Input variable (QC)
        <select value={active} onChange={(e) => setVariable(e.target.value)}>
          {available.map((k) => {
            const label =
              k === active
                ? activeLabel
                : ROCK_VOLUME_ARRAY_KEYS.has(k) && rockVolumeUnit
                  ? `${(ARRAY_LABELS[k] ?? k).split('(')[0].trim()} (${rockVolumeInputUnitLabel(rockVolumeUnit)})`
                  : (ARRAY_LABELS[k] ?? k)
            return (
              <option key={k} value={k}>
                {label}
              </option>
            )
          })}
        </select>
      </label>
      <div className="chart-card">
        <h3>Input distribution histogram</h3>
        <p className="chart-caption">
          QC check: sampled marginal for Area, Net Pay, NRV, HC Yield, etc.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={histogram} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e6ed" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Bar dataKey="count" fill="#5a7a9a" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
