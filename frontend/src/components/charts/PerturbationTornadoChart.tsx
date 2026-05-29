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
import type { ChartScopeSelection } from '../../utils/chartScope'
import { buildChartScopeOptions, defaultChartScopeSelection } from '../../utils/chartScope'
import { ChartScopeFilter } from './ChartScopeFilter'

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
  scopeSelection?: ChartScopeSelection
  onScopeChange?: (next: ChartScopeSelection) => void
  showScopeFilter?: boolean
}

export function PerturbationTornadoChart({
  input,
  scopeSelection: scopeSelectionProp,
  onScopeChange,
  showScopeFilter = true,
}: PerturbationTornadoChartProps) {
  const { getGroupDependencyContext, uncertaintyGroups, segments, reservoirs, simulation } =
    useWorkflow()
  const [targetKey, setTargetKey] = useState<string>('total_mmboe')
  const scopeOptions = useMemo(
    () => buildChartScopeOptions(simulation, segments, reservoirs),
    [simulation, segments, reservoirs],
  )
  const [internalScope, setInternalScope] = useState<ChartScopeSelection>(() =>
    defaultChartScopeSelection(simulation, segments, reservoirs),
  )
  const scopeSelection = scopeSelectionProp ?? internalScope
  const setScopeSelection = onScopeChange ?? setInternalScope
  const scopeType = scopeSelection.scopeType
  const scopeId = scopeSelection.scopeId
  const scopeLabel =
    scopeOptions[scopeType].find((o) => o.id === scopeId)?.label ??
    (scopeType === 'prospect' ? 'Prospect total' : scopeId)
  const [data, setData] = useState<PerturbationTornadoResult | null>(null)
  const [meta, setMeta] = useState<PerturbationTornadoResponse['multi_tank'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    } catch (e) {
      setData(null)
      setMeta(null)
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
      {showScopeFilter && !scopeSelectionProp && (
        <ChartScopeFilter
          selection={scopeSelection}
          options={scopeOptions}
          onChange={setScopeSelection}
          disabled={loading}
        />
      )}
      {scopeLabel ? (
        <p className="convention-inline chart-scope-caption">
          OAT scope: <strong>{scopeLabel}</strong>
        </p>
      ) : null}

      {error && <div className="alert error">{error}</div>}

      {uncertaintyGroups.length > 0 && !meta?.group_oat && !error && (
        <div className="alert warn">
          Group OAT is not active — restart the service and click <strong>Refresh</strong>.
        </div>
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
        </div>
      )}

      {fixed.length > 0 && (
        <p className="alert info" style={{ marginTop: '0.75rem' }}>
          <strong>Fixed inputs:</strong> {fixed.map((d) => d.label).join(', ')}
        </p>
      )}
    </div>
  )
}
