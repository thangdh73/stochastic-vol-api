import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CorrelationMatrixGrid } from '../components/CorrelationMatrixGrid'
import { CorrelationSharingPanel } from '../components/CorrelationSharingPanel'
import { GroupDependencySection } from '../components/GroupDependencySection'
import { NumericInput } from '../components/NumericInput'
import { InputScopeBadge } from '../components/InputScopeBadge'
import { TankSelectorStrip } from '../components/TankSelectorStrip'
import { ValidateBar } from '../components/ValidateBar'
import { WorkflowGate } from '../components/WorkflowGate'
import { useWorkflow } from '../context/WorkflowContext'
import type { CorrelationPair, SimulationInput } from '../types/api'
import {
  addRecommendedPairs,
  correlatableVariables,
  findPair,
  pruneCorrelationsForMethod,
  recommendedPairsForInput,
  syncCorrelationMatrix,
  upsertPair,
  VARIABLE_LABELS,
} from '../utils/correlations'
import { effectiveEstimatingMethod } from '../utils/estimatingMethod'

type CorrelationMode = NonNullable<SimulationInput['correlation_mode']>

function correlationActive(mode: CorrelationMode | undefined): boolean {
  return mode === 'rank' || mode === 'gaussian_copula'
}

function rhoColumnLabel(mode: CorrelationMode | undefined): string {
  if (mode === 'gaussian_copula') return 'ρ (Pearson, normal scores)'
  if (mode === 'rank') return 'ρ (Spearman rank)'
  return 'ρ'
}

export function CorrelationsPage() {
  const { input, setInput, clearModulePreviews, simulation, setSimulation, uncertaintyGroups } =
    useWorkflow()

  useEffect(() => {
    if (!input) return
    const pruned = pruneCorrelationsForMethod(input)
    const expected = correlatableVariables(pruned)
    const matrixVars = pruned.correlation_matrix?.variables ?? []
    const matrixStale =
      matrixVars.length !== expected.length ||
      expected.some((v, i) => matrixVars[i] !== v)
    if (
      pruned.correlations?.length !== (input.correlations?.length ?? 0) ||
      matrixStale ||
      !input.correlation_matrix
    ) {
      setInput(syncCorrelationMatrix(pruned))
    }
  }, [input?.estimating_method, input?.nrv_entry_mode, input?.fluid_type])

  const patchInput = (next: SimulationInput) => {
    const synced = syncCorrelationMatrix(pruneCorrelationsForMethod(next))
    setInput(synced)
    if (simulation) setSimulation(null)
    clearModulePreviews()
  }

  const setMode = (mode: CorrelationMode) => {
    if (!input) return
    patchInput({ ...input, correlation_mode: mode })
  }

  const ensureCorrelatedMode = (current: SimulationInput): CorrelationMode => {
    const m = current.correlation_mode ?? 'independent'
    if (m === 'rank' || m === 'gaussian_copula') return m
    return 'rank'
  }

  const updatePair = (
    a: string,
    b: string,
    patch: Partial<CorrelationPair>,
  ) => {
    if (!input) return
    const correlations = upsertPair(input.correlations ?? [], a, b, patch)
    patchInput({
      ...input,
      correlations,
      correlation_mode: ensureCorrelatedMode(input),
    })
  }

  const loadRecommended = () => {
    if (!input) return
    patchInput(
      addRecommendedPairs({
        ...input,
        correlation_mode: correlationActive(input.correlation_mode)
          ? input.correlation_mode!
          : 'independent',
      }),
    )
  }

  const enabledPairCount =
    input?.correlations?.filter((p) => p.enabled).length ?? 0

  const customPairs = (input?.correlations ?? []).filter((p) => {
    const rec = input ? recommendedPairsForInput(input) : []
    return !rec.some(
      (r) =>
        (r.a === p.variable_a && r.b === p.variable_b) ||
        (r.a === p.variable_b && r.b === p.variable_a),
    )
  })

  const mode = input?.correlation_mode ?? 'independent'
  const pairsEnabled = correlationActive(mode)

  return (
    <div>
      <h1 className="page-title">Correlations</h1>
      <p className="page-desc">
        Set <strong>prospect-level dependencies</strong> between named uncertainty groups (e.g.{' '}
        <code>Poro_R1_S1,2</code> ↔ <code>Sw_R1_S1,2</code>), then optional{' '}
        <strong>per-tank</strong> matrices for parameters not covered by groups. Define groups in{' '}
        <Link to="/dependency/groups">Dependency → Groups</Link>.
      </p>
      {input && effectiveEstimatingMethod(input) === 'nrv_grv_yield' && (
        <div className="alert info">
          NRV method: volumetric rows are <strong>GRV</strong>, <strong>% trap fill</strong>, and{' '}
          <strong>Net/Gross</strong> (or <strong>NRV direct</strong> if that entry mode is
          selected). Area and Net Pay are not used. GRV↔N/G can also be set on the{' '}
          <Link to="/nrv">NRV / GRV</Link> tab via rank correlation.
        </div>
      )}

      <WorkflowGate>
        <GroupDependencySection />
        <InputScopeBadge />
        <TankSelectorStrip />
        <CorrelationSharingPanel />
        {input && (
          <>
            <div className="card">
              <h2>
                {uncertaintyGroups.length > 0
                  ? 'Per-tank correlations (active tank)'
                  : 'Sampling mode (active tank)'}
              </h2>
              {uncertaintyGroups.length > 0 && (
                <p className="convention-inline">
                  Use this section for parameters inside the active tank that are{' '}
                  <strong>not</strong> assigned to an uncertainty group, or for fine-tuning before
                  the engine uses group-level MC. The group matrix above is the primary dependency
                  model for tornado and multi-tank work.
                </p>
              )}
              <label className="radio-row">
                <input
                  type="radio"
                  name="corr-mode"
                  checked={mode === 'independent'}
                  onChange={() => setMode('independent')}
                />
                Independent — no correlation
              </label>
              <label className="radio-row">
                <input
                  type="radio"
                  name="corr-mode"
                  checked={mode === 'rank'}
                  onChange={() => setMode('rank')}
                />
                Rank correlation (Iman–Conover, Spearman ρ)
              </label>
              <label className="radio-row">
                <input
                  type="radio"
                  name="corr-mode"
                  checked={mode === 'gaussian_copula'}
                  onChange={() => setMode('gaussian_copula')}
                />
                Gaussian copula (Pearson ρ on normal scores)
              </label>
            </div>

            <div className="card">
              <h2>
                {uncertaintyGroups.length > 0
                  ? 'Per-tank correlation matrix'
                  : 'Correlation matrix'}
              </h2>
              <p className="convention-inline">
                Edit ρ in the grid (symmetric: row i ↔ column j). Diagonal is
                always 1. Setting a cell to 0 removes that pair; any |ρ| &gt; 0
                enables the pair. Matrix and list stay in sync.
                {pairsEnabled
                  ? ` ${enabledPairCount} active pair(s).`
                  : ' Select rank or Gaussian mode to edit.'}
              </p>
              <CorrelationMatrixGrid
                input={input}
                disabled={!pairsEnabled}
                onChange={patchInput}
              />
            </div>

            <div className="card">
              <div className="card-header-row">
                <h2>Correlation pairs (linked to matrix cells)</h2>
                <button type="button" className="btn-secondary" onClick={loadRecommended}>
                  Add recommended pairs
                </button>
              </div>
              <p className="convention-inline">
                Each row is one off-diagonal matrix entry. Enable + ρ here, or
                edit the matrix above — both update the same data sent to the API
                as <code>correlations</code> and <code>correlation_matrix</code>.
              </p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Use</th>
                    <th>Variables</th>
                    <th>{rhoColumnLabel(mode)}</th>
                    <th>Matrix cell</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendedPairsForInput(input).map((rec) => {
                    const pair =
                      findPair(input.correlations ?? [], rec.a, rec.b) ??
                      ({
                        variable_a: rec.a,
                        variable_b: rec.b,
                        rho: 0,
                        enabled: false,
                        notes: '',
                      } as CorrelationPair)
                    return (
                      <tr key={`${rec.a}-${rec.b}`}>
                        <td>
                          <input
                            type="checkbox"
                            checked={pair.enabled && pairsEnabled}
                            disabled={!pairsEnabled}
                            onChange={(e) =>
                              updatePair(rec.a, rec.b, { enabled: e.target.checked })
                            }
                          />
                        </td>
                        <td>{rec.label}</td>
                        <td>
                          <NumericInput
                            allowEmpty={false}
                            value={pair.rho}
                            disabled={!pairsEnabled || !pair.enabled}
                            onChange={(v) =>
                              updatePair(rec.a, rec.b, {
                                rho: Math.min(1, Math.max(-1, v ?? 0)),
                              })
                            }
                          />
                        </td>
                        <td className="matrix-cell-ref">
                          ({rec.a}, {rec.b})
                        </td>
                        <td>
                          <input
                            type="text"
                            value={pair.notes ?? ''}
                            disabled={!pairsEnabled}
                            placeholder="Optional"
                            onChange={(e) =>
                              updatePair(rec.a, rec.b, { notes: e.target.value })
                            }
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {customPairs.length > 0 && (
                <p className="convention-inline">
                  Additional pairs from matrix:{' '}
                  {customPairs
                    .filter((p) => p.enabled)
                    .map(
                      (p) =>
                        `${VARIABLE_LABELS[p.variable_a] ?? p.variable_a} ↔ ${VARIABLE_LABELS[p.variable_b] ?? p.variable_b} (${p.rho})`,
                    )
                    .join('; ')}
                </p>
              )}
            </div>

            <ValidateBar />
            <p className="nav-hint">
              <Link to="/simulation">Continue to Simulation →</Link>
            </p>
          </>
        )}
      </WorkflowGate>
    </div>
  )
}
