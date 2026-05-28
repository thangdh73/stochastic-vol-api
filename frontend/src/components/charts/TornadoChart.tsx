import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ARRAY_LABELS, RESOURCE_ARRAY_KEYS } from '../../constants/chartVariables'
import type { SimulationArrays } from '../../types/api'
import { computeTornadoDrivers, primaryResourceTargetKey } from '../../utils/sensitivity'

interface TornadoChartProps {
  arrays: SimulationArrays
  groupDriverMap?: Record<string, { group_id: string; group_name: string }>
}

const TARGET_OPTIONS = [...RESOURCE_ARRAY_KEYS]

function formatRho(v: number): string {
  return v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2)
}

export function TornadoChart({ arrays, groupDriverMap }: TornadoChartProps) {
  const defaultTarget = primaryResourceTargetKey(arrays) ?? 'total_mmboe'
  const availableTargets = TARGET_OPTIONS.filter((k) => (arrays[k]?.length ?? 0) > 0)
  const [targetKey, setTargetKey] = useState(
    availableTargets.includes(defaultTarget as (typeof TARGET_OPTIONS)[number])
      ? defaultTarget
      : availableTargets[0] ?? 'total_mmboe',
  )

  const drivers = useMemo(() => {
    const base = computeTornadoDrivers(arrays, targetKey)
    if (!groupDriverMap) return base
    return base.map((d) => {
      const mapped = groupDriverMap[d.key]
      if (!mapped) return d
      return { ...d, label: mapped.group_name }
    })
  }, [arrays, targetKey, groupDriverMap])

  const varyingDrivers = useMemo(() => drivers.filter((d) => !d.isFixed), [drivers])
  const fixedDrivers = useMemo(() => drivers.filter((d) => d.isFixed), [drivers])

  const chartData = useMemo(
    () =>
      varyingDrivers.map((d) => ({
        ...d,
        barValue: d.rho,
      })),
    [varyingDrivers],
  )

  const maxAbs = useMemo(
    () => Math.max(0.15, ...varyingDrivers.map((d) => d.absRho)),
    [varyingDrivers],
  )

  if (!availableTargets.length) {
    return (
      <p className="convention-inline">
        No resource output arrays in this run — run simulation with arrays included.
      </p>
    )
  }

  if (varyingDrivers.length === 0 && fixedDrivers.length === 0) {
    return (
      <p className="convention-inline">
        Not enough input samples to rank drivers (need at least two sampled inputs).
      </p>
    )
  }

  if (varyingDrivers.length === 0 && fixedDrivers.length > 0) {
    return (
      <div className="alert warn">
        <p>
          All volumetric inputs in this run are <strong>fixed</strong> (no Monte Carlo spread), so
          Spearman sensitivity bars are empty. For NTG impact on STOIIP, set{' '}
          <strong>Net/Gross</strong> to lognormal or triangular on{' '}
          <strong>NRV / GRV</strong>, then re-run simulation.
        </p>
        <p className="convention-inline" style={{ marginTop: '0.5rem' }}>
          Fixed in this run: {fixedDrivers.map((d) => d.label).join(', ')}
        </p>
      </div>
    )
  }

  return (
    <div className="chart-section tornado-section">
      <div className="chart-select-row">
        <label>
          Sensitivity target
          <select value={targetKey} onChange={(e) => setTargetKey(e.target.value)}>
            {availableTargets.map((k) => (
              <option key={k} value={k}>
                {ARRAY_LABELS[k] ?? k}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="chart-caption">
        Tornado proxy: Spearman rank correlation ρ between each sampled input and the
        selected output (same iteration index). Bar length = |ρ|; sign shows direction.
        Not a one-at-a-time P10/P90 perturbation tornado.
      </p>
      {targetKey === 'stoiip_mmbbl' && (
        <p className="convention-inline">
          For <strong>STOIIP</strong>, GRV, fill, N/G, porosity, and saturation usually show{' '}
          <strong>positive ρ</strong> (they multiply into HCPV). <strong>Oil FVF</strong> is in the
          denominator (higher FVF → lower STOIIP), so it normally shows <strong>negative ρ</strong>{' '}
          when FVF is probabilistic — if FVF is fixed, it appears under “No bar (fixed input)” below.
        </p>
      )}
      {targetKey === 'giip_bcf' && (
        <p className="convention-inline">
          For <strong>GIIP</strong>, <strong>GEF</strong> is in the denominator (higher GEF → lower
          GIIP) and typically shows negative ρ when GEF is sampled.
        </p>
      )}
      <div className="chart-card tornado-chart-card">
        <h3>Input drivers — {ARRAY_LABELS[targetKey] ?? targetKey}</h3>
        <ResponsiveContainer
          width="100%"
          height={Math.max(220, varyingDrivers.length * 36)}
        >
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              domain={[-maxAbs, maxAbs]}
              tickFormatter={(v) => Number(v).toFixed(2)}
              label={{
                value: 'Spearman ρ',
                position: 'insideBottom',
                offset: -4,
                style: { fontSize: 12, fill: '#5a6b7d' },
              }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={200}
              tick={{ fontSize: 11 }}
            />
            <ReferenceLine x={0} stroke="#94a3b8" />
            <Tooltip
              formatter={(value) => [
                formatRho(typeof value === 'number' ? value : Number(value)),
                'Spearman ρ',
              ]}
              labelFormatter={(label) => String(label)}
            />
            <Bar dataKey="barValue" radius={[0, 3, 3, 0]}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={entry.rho >= 0 ? '#2e6b9e' : '#c45c5c'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="convention-inline tornado-legend">
          <span className="tornado-swatch positive" /> Positive ρ — higher input tends to
          higher output &nbsp;
          <span className="tornado-swatch negative" /> Negative ρ — inverse relationship
        </p>
        {fixedDrivers.length > 0 && (
          <p className="alert info" style={{ marginTop: '0.75rem' }}>
            <strong>No bar (fixed input):</strong>{' '}
            {fixedDrivers.map((d) => d.label).join(', ')} — constant across all iterations, so
            Spearman ρ is undefined. Use a probabilistic distribution on{' '}
            <strong>NRV / GRV</strong> to see NTG (or fill) in the tornado.
          </p>
        )}
      </div>
    </div>
  )
}
