import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../../api/client'
import {
  apiSupportsPerturbationTornado,
  formatApiError,
  PERTURBATION_TORNADO_RESTART_HINT,
} from '../../api/errors'
import { ARRAY_LABELS } from '../../constants/chartVariables'
import type {
  PerturbationTornadoResult,
  PerturbationTornadoResponse,
  SimulationInput,
} from '../../types/api'
import { useWorkflow } from '../../context/WorkflowContext'

const TARGET_OPTIONS = [
  'total_mmboe',
  'stoiip_mmbbl',
  'recoverable_oil_mmbbl',
  'solution_gas_bcf',
  'giip_bcf',
  'recoverable_gas_bcf',
  'condensate_mmbbl',
] as const

function formatDelta(v: number, unit: string): string {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(3)} ${unit}`.trim()
}

interface PerturbationTornadoChartProps {
  input: SimulationInput
}

export function PerturbationTornadoChart({ input }: PerturbationTornadoChartProps) {
  const { getGroupDependencyContext, uncertaintyGroups } = useWorkflow()
  const [targetKey, setTargetKey] = useState<string>('total_mmboe')
  const [scopeType, setScopeType] = useState<'prospect' | 'reservoir' | 'segment' | 'tank'>('prospect')
  const [scopeId, setScopeId] = useState<string>('')
  const [data, setData] = useState<PerturbationTornadoResult | null>(null)
  const [meta, setMeta] = useState<PerturbationTornadoResponse['multi_tank'] | null>(null)
  const [serverDebug, setServerDebug] = useState<PerturbationTornadoResponse['debug_context'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ctx = getGroupDependencyContext()
  const tankKeys = Object.keys(ctx?.tank_inputs ?? {})
  const reservoirOptions = Array.from(
    new Set(tankKeys.map((k) => (k.includes('::') ? k.split('::')[1] : k))),
  )
  const segmentOptions = Array.from(
    new Set(tankKeys.map((k) => (k.includes('::') ? k.split('::')[0] : k))),
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const health = await api.health()
      if (!apiSupportsPerturbationTornado(health)) {
        setData(null)
        setError(
          `Workbook OAT tornado is not available on this API (missing tornado_perturbation). ${PERTURBATION_TORNADO_RESTART_HINT}`,
        )
        return
      }
      const res = await api.fetchPerturbationTornado(
        input,
        targetKey,
        getGroupDependencyContext() ?? undefined,
        scopeType,
        scopeType === 'prospect' ? undefined : scopeId || undefined,
      )
      setData(res.tornado)
      setMeta(res.multi_tank ?? null)
      setServerDebug(res.debug_context ?? null)
    } catch (e) {
      setData(null)
      setMeta(null)
      setServerDebug(null)
      setError(formatApiError(e, 'Perturbation tornado'))
    } finally {
      setLoading(false)
    }
  }, [input, targetKey, getGroupDependencyContext, scopeType, scopeId])

  useEffect(() => {
    void load()
  }, [load])

  const varying = useMemo(
    () => (data?.drivers ?? []).filter((d) => !d.is_fixed),
    [data],
  )
  const fixed = useMemo(
    () => (data?.drivers ?? []).filter((d) => d.is_fixed),
    [data],
  )

  const chartRows = useMemo(
    () =>
      varying.map((d) => ({
        label: d.label,
        deltaLow: d.delta_low,
        deltaHigh: d.delta_high,
      })),
    [varying],
  )

  const maxAbs = useMemo(() => {
    if (!chartRows.length) return 1
    return Math.max(
      0.01,
      ...chartRows.flatMap((r) => [Math.abs(r.deltaLow), Math.abs(r.deltaHigh)]),
    )
  }, [chartRows])

  const unit = data?.target_unit ?? ''

  return (
    <div className="chart-section tornado-section">
      <div className="chart-select-row">
        <label>
          Sensitivity target
          <select
            value={targetKey}
            onChange={(e) => setTargetKey(e.target.value)}
            disabled={loading}
          >
            {TARGET_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {ARRAY_LABELS[k] ?? k}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void load()} disabled={loading}>
          {loading ? 'Computing…' : 'Refresh'}
        </button>
      </div>
      {ctx && (
        <div className="chart-select-row" style={{ marginTop: '0.5rem' }}>
          <label>
            Tornado scope
            <select
              value={scopeType}
              onChange={(e) => {
                const t = e.target.value as typeof scopeType
                setScopeType(t)
                setScopeId('')
              }}
              disabled={loading}
            >
              <option value="prospect">Prospect</option>
              <option value="reservoir">Reservoir</option>
              <option value="segment">Segment</option>
              <option value="tank">Tank</option>
            </select>
          </label>
          {scopeType !== 'prospect' && (
            <label>
              {scopeType === 'tank'
                ? 'Tank'
                : scopeType === 'reservoir'
                  ? 'Reservoir'
                  : 'Segment'}
              <select value={scopeId} onChange={(e) => setScopeId(e.target.value)} disabled={loading}>
                <option value="">All in scope</option>
                {(scopeType === 'tank'
                  ? tankKeys
                  : scopeType === 'reservoir'
                    ? reservoirOptions
                    : segmentOptions
                ).map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      <p className="chart-caption">
        Workbook OAT tornado: base case uses <strong>P50</strong> for all active inputs.
        Each bar swings one input to <strong>P90</strong> (low) or <strong>P10</strong> (high)
        while others stay at P50. Input correlations are <em>not</em> applied. P90/P10 labels
        follow P10-large input convention.
      </p>

      {error && <div className="alert error">{error}</div>}

      {uncertaintyGroups.length > 0 && !meta?.group_oat && !error && (
        <div className="alert warn">
          Group OAT is not active in this response (showing legacy per-variable drivers). If you
          expected group names, restart backend and click <strong>Refresh</strong>.
        </div>
      )}
      {uncertaintyGroups.length > 0 && (
        <p className="convention-inline" style={{ marginTop: '0.5rem' }}>
          Debug — groups configured: <strong>{uncertaintyGroups.length}</strong>; context tank
          inputs: <strong>{Object.keys(ctx?.tank_inputs ?? {}).length}</strong>; response group
          OAT: <strong>{meta?.group_oat ? 'on' : 'off'}</strong>; response multi-tank:{' '}
          <strong>{meta?.enabled ? 'on' : 'off'}</strong>; server groups:{' '}
          <strong>{serverDebug?.groups ?? 0}</strong>; server tank inputs:{' '}
          <strong>{serverDebug?.tank_inputs ?? 0}</strong>.
        </p>
      )}

      {data && (
        <p className="convention-inline">
          Base ({data.target_label}): <strong>{data.base_value.toFixed(4)}</strong>{' '}
          {unit}
        </p>
      )}

      {data && varying.length === 0 && fixed.length > 0 && (
        <div className="alert warn">
          All inputs are fixed at a single value — no OAT swing. Use probabilistic
          distributions on key drivers (e.g. GRV, NTG, porosity).
        </div>
      )}

      {chartRows.length > 0 && data && (
        <div className="chart-card tornado-chart-card">
          <h3>
            OAT drivers — {data.target_label} ({unit})
          </h3>
          <ResponsiveContainer
            width="100%"
            height={Math.max(220, chartRows.length * 40)}
          >
            <BarChart
              data={chartRows}
              layout="vertical"
              stackOffset="sign"
              margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                domain={[-maxAbs * 1.1, maxAbs * 1.1]}
                tickFormatter={(v) => Number(v).toFixed(2)}
                label={{
                  value: `Δ vs base (${unit})`,
                  position: 'insideBottom',
                  offset: -4,
                  style: { fontSize: 12, fill: '#5a6b7d' },
                }}
              />
              <YAxis type="category" dataKey="label" width={200} tick={{ fontSize: 11 }} />
              <ReferenceLine x={0} stroke="#94a3b8" />
              <Tooltip
                formatter={(value, name) => [
                  formatDelta(typeof value === 'number' ? value : Number(value), unit),
                  name === 'deltaLow' ? 'P90 swing (low input)' : 'P10 swing (high input)',
                ]}
              />
              <Legend />
              <Bar dataKey="deltaLow" name="P90 swing" stackId="t" fill="#c45c5c" />
              <Bar dataKey="deltaHigh" name="P10 swing" stackId="t" fill="#2e6b9e" />
            </BarChart>
          </ResponsiveContainer>
          <p className="convention-inline tornado-legend">
            Red = change when driver set to input P90; blue = change when driver set to input
            P10 (others at P50).
          </p>
        </div>
      )}

      {fixed.length > 0 && (
        <p className="alert info" style={{ marginTop: '0.75rem' }}>
          <strong>No swing (fixed input):</strong>{' '}
          {fixed.map((d) => d.label).join(', ')}
        </p>
      )}

      {data?.method_note && (
        <p className="convention-inline" style={{ marginTop: '0.5rem' }}>
          {data.method_note}
        </p>
      )}
    </div>
  )
}
