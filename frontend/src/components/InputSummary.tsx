import type { DistributionSpec, SimulationInput } from '../types/api'
import { usesCcopRisk } from '../utils/calculationToggles'

const DIST_KEYS: { key: keyof SimulationInput; label: string }[] = [
  { key: 'area_dist', label: 'Area' },
  { key: 'percent_fill_dist', label: 'Percent fill' },
  { key: 'net_pay_dist', label: 'Net pay' },
  { key: 'geometric_correction_dist', label: 'Geometric correction' },
  { key: 'porosity_dist', label: 'Porosity' },
  { key: 'saturation_dist', label: 'HC saturation' },
  { key: 'oil_recovery_dist', label: 'Oil recovery' },
  { key: 'fvf_dist', label: 'FVF' },
  { key: 'gor_dist', label: 'GOR' },
  { key: 'solution_gas_recovery_dist', label: 'Solution gas recovery' },
  { key: 'gas_recovery_dist', label: 'Gas recovery' },
  { key: 'gef_dist', label: 'GEF' },
  { key: 'condensate_yield_dist', label: 'Condensate yield' },
]

function distSummary(d: DistributionSpec): string {
  if (d.distribution_type === 'fixed' && d.fixed_value != null) {
    return `Fixed ${d.fixed_value}`
  }
  const parts = []
  if (d.p90 != null) parts.push(`P90=${d.p90}`)
  if (d.p50 != null) parts.push(`P50=${d.p50}`)
  if (d.p10 != null) parts.push(`P10=${d.p10}`)
  return `${d.distribution_type} (${parts.join(', ')})`
}

interface InputSummaryProps {
  input: SimulationInput
}

export function InputSummary({ input }: InputSummaryProps) {
  return (
    <div>
      <dl className="meta-grid">
        <div>
          <dt>Prospect</dt>
          <dd>{input.prospect_name}</dd>
        </div>
        <div>
          <dt>Fluid</dt>
          <dd>{input.fluid_type}</dd>
        </div>
        <div>
          <dt>Zone</dt>
          <dd>{input.zone_name}</dd>
        </div>
        <div>
          <dt>Iterations</dt>
          <dd>{input.n_iterations}</dd>
        </div>
        <div>
          <dt>Seed</dt>
          <dd>{input.seed}</dd>
        </div>
        <div>
          <dt>Correlations</dt>
          <dd>
            {input.correlation_mode === 'rank'
              ? `${(input.correlations ?? []).filter((p) => p.enabled).length} rank pair(s)`
              : input.correlation_mode === 'gaussian_copula'
                ? `${(input.correlations ?? []).filter((p) => p.enabled).length} Gaussian copula pair(s)`
                : 'Independent'}
          </dd>
        </div>
        <div>
          <dt>Gas-oil ratio</dt>
          <dd>{input.gas_oil_ratio} mcf/bbl</dd>
        </div>
      </dl>
      <table className="data-table" style={{ marginTop: '1rem' }}>
        <thead>
          <tr>
            <th>Variable</th>
            <th>Type / values</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody>
          {DIST_KEYS.map(({ key, label }) => {
            const d = input[key] as DistributionSpec | null | undefined
            if (!d) return null
            return (
              <tr key={key}>
                <td>{label}</td>
                <td>{distSummary(d)}</td>
                <td>{d.unit || d.canonical_unit || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {usesCcopRisk(input) && input.ccop_risk ? (
        <>
          <h3 style={{ fontSize: '0.92rem', marginTop: '1rem' }}>CCOP risk (P1–P4)</h3>
          <table className="data-table">
            <tbody>
              <tr>
                <td>Reservoir (P1)</td>
                <td>
                  {input.ccop_risk.reservoir.facies_presence} ×{' '}
                  {input.ccop_risk.reservoir.effectiveness}
                </td>
              </tr>
              <tr>
                <td>Trap (P2)</td>
                <td>
                  structure {input.ccop_risk.trap.structure}
                  {input.ccop_risk.trap.seal_top != null
                    ? ` · top seal ${input.ccop_risk.trap.seal_top}`
                    : ''}
                  {input.ccop_risk.trap.seal_lateral != null
                    ? ` · lateral seal ${input.ccop_risk.trap.seal_lateral}`
                    : ''}
                </td>
              </tr>
              <tr>
                <td>Charge (P3)</td>
                <td>
                  sources [{input.ccop_risk.charge.sources.join(', ')}] · migration{' '}
                  {input.ccop_risk.charge.migration}
                </td>
              </tr>
              <tr>
                <td>Retention (P4)</td>
                <td>{input.ccop_risk.retention}</td>
              </tr>
            </tbody>
          </table>
        </>
      ) : (
        Object.keys(input.chance_categories).length > 0 && (
          <>
            <h3 style={{ fontSize: '0.92rem', marginTop: '1rem' }}>Chance categories (legacy)</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Sub-factors</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(input.chance_categories).map(([cat, factors]) => (
                  <tr key={cat}>
                    <td>{cat}</td>
                    <td>{factors.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )
      )}
    </div>
  )
}
