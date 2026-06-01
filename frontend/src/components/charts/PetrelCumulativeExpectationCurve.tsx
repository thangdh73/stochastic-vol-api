import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PetrelCumulativeRunResult } from '../../types/api'
import { buildExceedance } from '../../utils/chartData'
import {
  PETREL_CATEGORIES,
  buildPetrelScopeOptions,
  getPetrelScopeValues,
  scopeTypeLabel,
  type PetrelCategory,
  type PetrelScopeType,
} from '../../utils/petrelCumulativeScope'

interface PetrelCumulativeExpectationCurveProps {
  result: PetrelCumulativeRunResult
}

const SCOPE_TYPES: PetrelScopeType[] = ['field', 'reservoir', 'segment', 'tank']

export function PetrelCumulativeExpectationCurve({
  result,
}: PetrelCumulativeExpectationCurveProps) {
  const options = useMemo(() => buildPetrelScopeOptions(result), [result])
  const [scopeType, setScopeType] = useState<PetrelScopeType>('field')
  const [scopeId, setScopeId] = useState<string>('field')
  const [category, setCategory] = useState<PetrelCategory>('2P')

  const scopeItems = options[scopeType] ?? []

  useEffect(() => {
    if (!scopeItems.some((o) => o.id === scopeId)) {
      setScopeId(scopeItems[0]?.id ?? '')
    }
  }, [scopeType, scopeItems, scopeId])

  const resolved = useMemo(
    () => getPetrelScopeValues(result, scopeType, scopeId, category),
    [result, scopeType, scopeId, category],
  )

  const exceedance = useMemo(
    () => (resolved ? buildExceedance(resolved.values) : []),
    [resolved],
  )
  const markers = resolved
    ? [
        { key: 'P90', value: resolved.summary.p90, color: '#2d8a4e' },
        { key: 'P50', value: resolved.summary.p50, color: '#c45c26' },
        { key: 'Mean', value: resolved.summary.mean_trimmed, color: '#7a3fb8' },
        { key: 'P10', value: resolved.summary.p10, color: '#1e6bb8' },
      ]
    : []

  if (!result.arrays || Object.keys(result.arrays).length === 0) {
    return (
      <div className="alert warn">
        No iteration arrays in this run. Re-run Petrel cumulative simulation from{' '}
        <strong>Output → Simulation</strong> (arrays are included automatically).
      </div>
    )
  }

  const unit = resolved?.unit ?? result.gas_unit
  const scopeLabel = scopeItems.find((o) => o.id === scopeId)?.label ?? 'Field total'

  return (
    <div className="chart-section">
      <div className="chart-select-row" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span className="field-label">Scope</span>
          <div className="toggle-row" style={{ gap: '0.75rem' }}>
            {SCOPE_TYPES.map((t) => {
              const disabled = (options[t] ?? []).length === 0
              return (
                <label
                  key={t}
                  className="toggle-row"
                  style={{ opacity: disabled ? 0.4 : 1 }}
                >
                  <input
                    type="radio"
                    name="petrel-scope-type"
                    checked={scopeType === t}
                    disabled={disabled}
                    onChange={() => setScopeType(t)}
                  />
                  {scopeTypeLabel(t)}
                </label>
              )
            })}
          </div>
        </div>

        {scopeType !== 'field' && (
          <label className="field-label">
            {scopeTypeLabel(scopeType)}
            <select value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
              {scopeItems.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="field-label">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as PetrelCategory)}
          >
            {PETREL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!resolved || resolved.values.length === 0 ? (
        <p className="alert warn">No iteration data for this scope / category.</p>
      ) : (
        <>
          <p className="chart-caption">
            Expectation (exceedance) curve — {scopeLabel} GIIP {category} ({unit}).{' '}
            P90 {resolved.summary.p90.toFixed(2)} · P50 {resolved.summary.p50.toFixed(2)} ·
            Mean {resolved.summary.mean_trimmed.toFixed(2)} · P10{' '}
            {resolved.summary.p10.toFixed(2)} {unit}.
          </p>
          <div className="chart-card">
            <h3>Expectation curve (P ≥ x)</h3>
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart
                data={exceedance}
                margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e6ed" />
                <XAxis
                  dataKey="value"
                  type="number"
                  domain={['auto', 'auto']}
                  tickFormatter={(v) => Number(v).toPrecision(3)}
                  label={{ value: `GIIP ${category} (${unit})`, position: 'insideBottom', offset: -4 }}
                />
                <YAxis
                  domain={[0, 1]}
                  label={{ value: 'Exceedance prob.', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  formatter={(v) => (typeof v === 'number' ? v.toFixed(4) : String(v ?? ''))}
                  labelFormatter={(v) => `${scopeLabel}: ${Number(v).toPrecision(4)} ${unit}`}
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
                    stroke={m.color}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    label={{ value: m.key, position: 'top', fontSize: 11, fill: m.color }}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
            <div className="chart-legend" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
              {markers.map((m) => (
                <span
                  key={m.key}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 18,
                      height: 0,
                      borderTop: `2px dashed ${m.color}`,
                    }}
                  />
                  {m.key}: {m.value.toFixed(2)} {unit}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
