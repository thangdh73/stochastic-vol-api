import type { ChartScopeOption, ChartScopeSelection, ChartScopeType } from '../../utils/chartScope'

const SCOPE_TYPE_LABELS: Record<ChartScopeType, string> = {
  prospect: 'Prospect (total)',
  reservoir: 'Reservoir',
  segment: 'Segment',
  tank: 'Tank',
}

interface ChartScopeFilterProps {
  selection: ChartScopeSelection
  options: Record<ChartScopeType, ChartScopeOption[]>
  onChange: (next: ChartScopeSelection) => void
  disabled?: boolean
  /** Hide scope picker when only one tank and prospect is the only meaningful filter. */
  compact?: boolean
}

export function ChartScopeFilter({
  selection,
  options,
  onChange,
  disabled = false,
  compact = false,
}: ChartScopeFilterProps) {
  const scopeOptions = options[selection.scopeType] ?? []
  const multiScope =
    options.tank.length > 1 ||
    options.reservoir.length > 1 ||
    options.segment.length > 1

  if (compact && !multiScope) return null

  return (
    <div className="chart-select-row chart-scope-filter">
      <label>
        Filter scope
        <select
          value={selection.scopeType}
          onChange={(e) => {
            const scopeType = e.target.value as ChartScopeType
            const first = options[scopeType][0]
            onChange({ scopeType, scopeId: first?.id ?? '' })
          }}
          disabled={disabled}
        >
          {(Object.keys(SCOPE_TYPE_LABELS) as ChartScopeType[]).map((t) => (
            <option key={t} value={t} disabled={options[t].length === 0}>
              {SCOPE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      {selection.scopeType !== 'prospect' && scopeOptions.length > 0 && (
        <label>
          {SCOPE_TYPE_LABELS[selection.scopeType]}
          <select
            value={selection.scopeId}
            onChange={(e) =>
              onChange({ ...selection, scopeId: e.target.value })
            }
            disabled={disabled}
          >
            {scopeOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
