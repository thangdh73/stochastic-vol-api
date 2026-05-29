import { NumericInput } from './NumericInput'
import { DistributionQcSimulateButton } from './DistributionQcSimulateButton'
import type { DistributionSpec } from '../types/api'
import { type PercentileField } from '../utils/inputHelpers'
import {
  defaultSkewEnabled,
  distributionSupportsSkew,
  distributionTypeOptionLabel,
  patchForDistributionTypeChange,
  patchPercentileWithSkew,
  skewHelpText,
} from '../utils/distributionSkew'

const CASE_LABELS = ['P90 (low)', 'P50 (mid)', 'P10 (high)'] as const

const TABLE_DIST_TYPES = [
  'fixed',
  'lognormal',
  'pert',
  'normal',
  'uniform',
  'triangular',
  'beta',
] as const

type Props = {
  dist: DistributionSpec
  onChange: (dist: DistributionSpec) => void
  rowLabel?: string
  helperText?: string
  asPercent?: boolean
  showQcHistogram?: boolean
  parameterTitle?: string
  nIterations?: number
  seed?: number
  variableKind?: 'generic' | 'fraction' | 'positive_resource'
}

/** Compact P90 / P50 / P10 table with optional skew (3-point fit). */
export function DistributionPercentilesTable({
  dist,
  onChange,
  rowLabel = 'Value',
  helperText,
  asPercent = false,
  showQcHistogram = false,
  parameterTitle,
  nIterations,
  seed,
  variableKind = 'generic',
}: Props) {
  const patch = (partial: Partial<DistributionSpec>) => onChange({ ...dist, ...partial })
  const isFixed = dist.distribution_type === 'fixed'
  const supportsSkew = distributionSupportsSkew(dist.distribution_type)
  const skewOn = Boolean(dist.skew_enabled)

  const patchPercentile = (field: PercentileField, value: number | null) => {
    const next = patchPercentileWithSkew(dist, field, value)
    if (dist.distribution_type === 'triangular') {
      if (field === 'p90' && dist.tri_min == null) next.tri_min = value
      if (field === 'p50' && dist.tri_mode == null) next.tri_mode = value
      if (field === 'p10' && dist.tri_max == null) next.tri_max = value
    }
    patch(next)
  }

  const p50Required = supportsSkew && skewOn

  return (
    <div className="dist-percentiles-panel">
      {helperText && (
        <p className="convention-inline muted" style={{ marginTop: 0 }}>
          {helperText}
        </p>
      )}
      <div className="dist-percentiles-type-row">
        <label className="dist-percentiles-type-label">
          Distribution type
          <select
            value={dist.distribution_type}
            onChange={(e) => patch(patchForDistributionTypeChange(dist, e.target.value))}
          >
            {TABLE_DIST_TYPES.map((t) => (
              <option key={t} value={t}>
                {distributionTypeOptionLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <span className="dist-percentiles-unit muted">{dist.unit || dist.canonical_unit}</span>
        {showQcHistogram && nIterations != null && seed != null && (
          <DistributionQcSimulateButton
            dist={dist}
            parameterTitle={parameterTitle ?? rowLabel}
            nIterations={nIterations}
            seed={seed}
            asPercent={asPercent}
            variableKind={variableKind}
          />
        )}
      </div>

      {supportsSkew && !isFixed && (
        <label className="dist-skew-toggle toggle-row">
          <input
            type="checkbox"
            checked={skewOn}
            onChange={(e) => patch({ skew_enabled: e.target.checked })}
          />
          Skew distribution (3-point P90 / P50 / P10 fit)
        </label>
      )}
      {supportsSkew && !isFixed && (
        <p className="convention-inline muted dist-skew-hint">
          {skewHelpText(dist.distribution_type, skewOn)}
          {defaultSkewEnabled(dist.distribution_type) && !skewOn && (
            <> Turn skew on to match original MMRA lognormal/beta behaviour.</>
          )}
        </p>
      )}

      {dist.distribution_type === 'beta' && (
        <div className="dist-beta-bounds-row">
          <label>
            Min bound
            <NumericInput
              allowEmpty={false}
              value={dist.min_bound ?? 0}
              onChange={(v) => patch({ min_bound: v })}
              asPercent={asPercent}
            />
          </label>
          <label>
            Max bound
            <NumericInput
              allowEmpty={false}
              value={dist.max_bound ?? 1}
              onChange={(v) => patch({ max_bound: v })}
              asPercent={asPercent}
            />
          </label>
        </div>
      )}

      <table className="data-table petrel-grv-input-table dist-percentiles-table">
        <thead>
          <tr>
            <th />
            {isFixed ? (
              <th>Value</th>
            ) : (
              CASE_LABELS.map((label) => (
                <th key={label}>
                  {label}
                  {label.includes('P50') && p50Required && (
                    <span className="dist-required-mark" title="Required when skew is on">
                      {' '}
                      *
                    </span>
                  )}
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{rowLabel}</th>
            {isFixed ? (
              <td>
                <NumericInput
                  allowEmpty={false}
                  value={dist.fixed_value}
                  onChange={(v) => patch({ fixed_value: v })}
                  asPercent={asPercent}
                />
              </td>
            ) : (
              CASE_LABELS.map((label, i) => {
                const field = i === 0 ? 'p90' : i === 1 ? 'p50' : 'p10'
                const value = field === 'p90' ? dist.p90 : field === 'p50' ? dist.p50 : dist.p10
                const disabled = isFixed && field !== 'p50'
                const emphasize = field === 'p50' && p50Required
                return (
                  <td key={label} className={emphasize ? 'dist-p50-skew-cell' : undefined}>
                    <span className="petrel-case-label">{label}</span>
                    <NumericInput
                      allowEmpty={!p50Required || field !== 'p50'}
                      value={value}
                      disabled={disabled}
                      onChange={(v) => patchPercentile(field, v)}
                      asPercent={asPercent}
                    />
                  </td>
                )
              })
            )}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
