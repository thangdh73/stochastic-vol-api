import type { DistributionSpec } from '../types/api'
import {
  defaultSkewEnabled,
  distributionSupportsSkew,
  distributionTypeOptionLabel,
  patchForDistributionTypeChange,
  patchPercentileWithSkew,
  skewHelpText,
} from '../utils/distributionSkew'
import { NumericInput } from './NumericInput'

const DIST_TYPES = [
  'fixed',
  'uniform',
  'normal',
  'lognormal',
  'triangular',
  'beta',
  'pert',
] as const

interface DistributionInputCardProps {
  dist: DistributionSpec
  onChange: (dist: DistributionSpec) => void
  /** When true, P90/P50/P10 and bounds are entered/displayed as % (stored as fraction) */
  asPercent?: boolean
  helperText?: string
}

function triangularFromPercentiles(dist: DistributionSpec): Partial<DistributionSpec> {
  const tri_min = dist.tri_min ?? dist.p90 ?? dist.low_clip ?? null
  const tri_max = dist.tri_max ?? dist.p10 ?? dist.high_clip ?? null
  const tri_mode =
    dist.tri_mode ??
    dist.p50 ??
    (dist.p90 != null && dist.p10 != null ? (dist.p90 + dist.p10) / 2 : null)
  return { tri_min, tri_mode, tri_max }
}

export function DistributionInputCard({
  dist,
  onChange,
  asPercent = false,
  helperText,
}: DistributionInputCardProps) {
  const patch = (partial: Partial<DistributionSpec>) =>
    onChange({ ...dist, ...partial })

  const supportsSkew = distributionSupportsSkew(dist.distribution_type)
  const skewOn = Boolean(dist.skew_enabled)
  const p50Required = supportsSkew && skewOn && dist.distribution_type !== 'fixed'

  const pctLabel = (label: string) =>
    asPercent ? `${label} (%)` : label

  return (
    <div className="dist-card">
      <div className="dist-card-header">
        <strong>{dist.display_name}</strong>
        <span className="dist-id">{dist.variable_id}</span>
      </div>

      <p className="convention-inline">
        Choose <strong>distribution type</strong> first, then enter values below. P90 = conservative
        (smaller) · P10 = upside (larger).
        {asPercent ? ' Enter fraction-style ranges as percentages here.' : ''}
      </p>
      {dist.distribution_type === 'fixed' ? (
        <p className="convention-inline muted">Fixed: enter one value — no P90/P50/P10 spread.</p>
      ) : (
        <p className="convention-inline muted">
          Uncertain: enter P90, P50, and P10 (required for simulation).
        </p>
      )}
      {helperText && <p className="convention-inline muted">{helperText}</p>}

      <div className="form-grid">
        <label>
          Distribution type
          <select
            value={dist.distribution_type}
            onChange={(e) => {
              const next = patchForDistributionTypeChange(dist, e.target.value)
              if (e.target.value === 'triangular') {
                Object.assign(next, triangularFromPercentiles(dist))
              }
              patch(next)
            }}
          >
            {DIST_TYPES.map((t) => (
              <option key={t} value={t}>
                {distributionTypeOptionLabel(t)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Unit
          <input
            type="text"
            value={dist.unit}
            onChange={(e) => patch({ unit: e.target.value, canonical_unit: e.target.value })}
          />
        </label>

        {supportsSkew && dist.distribution_type !== 'fixed' && (
          <>
            <label className="span-2 dist-skew-toggle toggle-row">
              <input
                type="checkbox"
                checked={skewOn}
                onChange={(e) => patch({ skew_enabled: e.target.checked })}
              />
              Skew distribution (3-point P90 / P50 / P10 fit)
            </label>
            <p className="convention-inline muted span-2 dist-skew-hint">
              {skewHelpText(dist.distribution_type, skewOn)}
              {defaultSkewEnabled(dist.distribution_type) && !skewOn && (
                <> Turn skew on to match original MMRA lognormal/beta behaviour.</>
              )}
            </p>
          </>
        )}

        {dist.distribution_type === 'fixed' && (
          <label>
            Fixed value{asPercent ? ' (%)' : ''}
            <NumericInput
              value={dist.fixed_value}
              onChange={(v) => patch({ fixed_value: v })}
              asPercent={asPercent}
            />
          </label>
        )}

        {dist.distribution_type !== 'fixed' && (
          <>
            <label>
              {pctLabel('P90 (conservative)')}
              <NumericInput
                value={dist.p90}
                onChange={(v) => {
                  const next = patchPercentileWithSkew(dist, 'p90', v)
                  if (dist.distribution_type === 'triangular' && dist.tri_min == null) {
                    Object.assign(next, { tri_min: v })
                  }
                  patch(next)
                }}
                asPercent={asPercent}
              />
            </label>
            <label>
              {pctLabel('P50 (median)')}
              {p50Required && (
                <span className="dist-required-mark" title="Required when skew is on">
                  {' '}
                  *
                </span>
              )}
              <NumericInput
                value={dist.p50}
                allowEmpty={!p50Required}
                onChange={(v) => {
                  const next = patchPercentileWithSkew(dist, 'p50', v)
                  if (dist.distribution_type === 'triangular' && dist.tri_mode == null) {
                    Object.assign(next, { tri_mode: v })
                  }
                  patch(next)
                }}
                asPercent={asPercent}
              />
            </label>
            <label>
              {pctLabel('P10 (upside)')}
              <NumericInput
                value={dist.p10}
                onChange={(v) => {
                  const next = patchPercentileWithSkew(dist, 'p10', v)
                  if (dist.distribution_type === 'triangular' && dist.tri_max == null) {
                    Object.assign(next, { tri_max: v })
                  }
                  patch(next)
                }}
                asPercent={asPercent}
              />
            </label>
          </>
        )}

        {dist.distribution_type === 'triangular' && (
          <>
            <label>
              Min
              <NumericInput
                value={dist.tri_min}
                onChange={(v) => patch({ tri_min: v })}
                asPercent={asPercent}
              />
            </label>
            <label>
              Mode
              <NumericInput
                value={dist.tri_mode}
                onChange={(v) => patch({ tri_mode: v })}
                asPercent={asPercent}
              />
            </label>
            <label>
              Max
              <NumericInput
                value={dist.tri_max}
                onChange={(v) => patch({ tri_max: v })}
                asPercent={asPercent}
              />
            </label>
          </>
        )}

        {(dist.distribution_type === 'beta' || dist.distribution_type === 'uniform') && (
          <>
            <label>
              {pctLabel('Min bound')}
              <NumericInput
                value={dist.min_bound}
                onChange={(v) => patch({ min_bound: v })}
                asPercent={asPercent}
              />
            </label>
            <label>
              {pctLabel('Max bound')}
              <NumericInput
                value={dist.max_bound}
                onChange={(v) => patch({ max_bound: v })}
                asPercent={asPercent}
              />
            </label>
          </>
        )}

        <label>
          Low clip
          <NumericInput
            value={dist.low_clip}
            onChange={(v) => patch({ low_clip: v })}
            asPercent={asPercent}
          />
        </label>
        <label>
          High clip
          <NumericInput
            value={dist.high_clip}
            onChange={(v) => patch({ high_clip: v })}
            asPercent={asPercent}
          />
        </label>

        <label className="span-2">
          Notes
          <input
            type="text"
            value={dist.notes ?? ''}
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </label>
      </div>
    </div>
  )
}
