import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AreaDistributionForm } from '../components/AreaDistributionForm'
import { ComplexTrapsPanel } from '../components/ComplexTrapsPanel'
import { DistributionInputCard } from '../components/DistributionInputCard'
import { InputScopeBadge } from '../components/InputScopeBadge'
import { NtgSharingPanel } from '../components/NtgSharingPanel'
import { TankNrvMatrix } from '../components/TankNrvMatrix'
import { TankSelectorStrip } from '../components/TankSelectorStrip'
import { ModuleQcSection } from '../components/ModuleQcSection'
import { ModuleSummariesCard } from '../components/ModuleSummariesCard'
import { NumericInput } from '../components/NumericInput'
import { RockVolumeDistributionForm } from '../components/RockVolumeDistributionForm'
import { ValidateBar } from '../components/ValidateBar'
import { WorkflowGate } from '../components/WorkflowGate'
import {
  areaInputUnitLabel,
  rockVolumeInputUnitLabel,
} from '../constants/inputUnits'
import { useWorkflow } from '../context/WorkflowContext'
import type { NrvEntryMode, RockVolumeInputUnit } from '../types/api'
import { ensureNrvDistributions } from '../utils/defaultInput'
import { effectiveEstimatingMethod } from '../utils/estimatingMethod'
import { areaChartUnitFromInput } from '../utils/inputDisplayUnits'
import { updateDistribution } from '../utils/inputHelpers'
import {
  complexTrapStatusMessage,
  withNrvComplexTrapEnabled,
} from '../utils/nrvComplexTrap'

export function NrvInputPage() {
  const { input, setInput, getModulePreview, setModulePreview, error } = useWorkflow()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const nrvPreview = getModulePreview('nrv')
  const crossWarnings = nrvPreview?.metadata?.cross_check_warnings as string[] | undefined

  useEffect(() => {
    if (!input) return
    if (effectiveEstimatingMethod(input) !== 'nrv_grv_yield') return
    const starters = ensureNrvDistributions(input)
    const stale =
      !input.grv_dist ||
      !input.grv_percent_fill_dist ||
      !input.net_to_gross_dist ||
      (input.grv_dist?.distribution_type === 'lognormal' &&
        (input.grv_dist.p90 == null || input.grv_dist.p10 == null))
    if (stale) setInput(starters)
    else if (!input.nrv_direct_multiplier_dist) setInput(ensureNrvDistributions(input))
  }, [input, setInput])

  if (!input) {
    return (
      <div>
        <h1 className="page-title">NRV / GRV</h1>
        <WorkflowGate>{null}</WorkflowGate>
      </div>
    )
  }

  const method = effectiveEstimatingMethod(input)
  const entryMode: NrvEntryMode = input.nrv_entry_mode ?? 'grv_fill_ntg'
  const patch = (partial: Partial<typeof input>) => handleInputChange({ ...input, ...partial })

  if (method !== 'nrv_grv_yield') {
    return (
      <div>
        <h1 className="page-title">NRV / GRV</h1>
        <div className="alert warn">
          This page is for <strong>Net Rock Volume x HC Yield</strong>. Switch method on{' '}
          <Link to="/prospect">Prospect Setup</Link>.
        </div>
      </div>
    )
  }

  const grv = input.grv_dist!
  const fill = input.grv_percent_fill_dist!
  const ntg = input.net_to_gross_dist!
  const nrvDirect = input.nrv_direct_dist!
  const ccArea = input.cross_check_area_dist!
  const grvUnit: RockVolumeInputUnit = input.grv_input_unit ?? 'acre_ft'
  const nrvUnit: RockVolumeInputUnit = input.nrv_input_unit ?? 'acre_ft'
  const reportVolumeUnit = entryMode === 'direct' ? nrvUnit : grvUnit
  const areaDisplayUnit = areaChartUnitFromInput(input)
  const ctStatus = complexTrapStatusMessage(input, nrvPreview?.metadata)

  const handleInputChange = (next: typeof input) => {
    const ctWas = input.complex_trap?.enabled
    const ctNow = next.complex_trap?.enabled
    const ctCaps =
      input.complex_trap?.element_1?.max_area_acres !== next.complex_trap?.element_1?.max_area_acres ||
      input.complex_trap?.element_2?.max_area_acres !== next.complex_trap?.element_2?.max_area_acres
    if (ctWas !== ctNow || ctCaps) {
      setModulePreview('nrv', null)
    }
    setInput(next)
  }

  return (
    <div>
      <h1 className="page-title">NRV / GRV</h1>
      <p className="page-desc">
        Enter rock-volume inputs for the active tank, then run NRV preview.
      </p>

      {error && <div className="alert error">{error}</div>}

      <WorkflowGate>
        <InputScopeBadge />
        <TankSelectorStrip />
        <TankNrvMatrix />

        <div className="card">
          <h2>1) Entry mode</h2>
          <p className="convention-inline">
            Units from Prospect Setup: GRV <strong>{rockVolumeInputUnitLabel(grvUnit)}</strong>, direct
            NRV <strong>{rockVolumeInputUnitLabel(nrvUnit)}</strong>.
          </p>
          <label className="radio-row">
            <input
              type="radio"
              name="nrv-entry"
              checked={entryMode === 'grv_fill_ntg'}
              onChange={() => patch({ nrv_entry_mode: 'grv_fill_ntg' })}
            />
            <span>
              <strong>GRV x Trap Fill x NTG</strong> (three distributions).
            </span>
          </label>
          <label className="radio-row">
            <input
              type="radio"
              name="nrv-entry"
              checked={entryMode === 'direct'}
              onChange={() => patch({ nrv_entry_mode: 'direct' })}
            />
            <span>
              <strong>Direct NRV</strong> (single distribution).
            </span>
          </label>
        </div>

        <div className="card">
          <h2>2) Core inputs</h2>
          {entryMode === 'grv_fill_ntg' && <NtgSharingPanel />}
          {entryMode === 'grv_fill_ntg' ? (
            <>
              <div className="nrv-core-grid">
                <div className="nrv-core-block">
                  <h3>Gross rock volume (GRV)</h3>
                  <RockVolumeDistributionForm
                    canonicalDist={grv}
                    displayUnit={grvUnit}
                    helperText="P90 ≤ P50 ≤ P10. P90 conservative, P10 upside."
                    onCommit={(canonical) =>
                      handleInputChange(updateDistribution(input, 'grv_dist', canonical))
                    }
                  />
                </div>
                <div className="nrv-core-block">
                  <h3>Percent trap fill</h3>
                  <DistributionInputCard
                    dist={fill}
                    helperText="Fraction 0–1 (e.g. 0.85 = 85% fill)."
                    onChange={(d) =>
                      handleInputChange(updateDistribution(input, 'grv_percent_fill_dist', d))
                    }
                  />
                </div>
                <div className="nrv-core-block">
                  <h3>Net to gross (NTG)</h3>
                  <DistributionInputCard
                    dist={ntg}
                    helperText="Fraction 0–1. Use min/max bounds when needed."
                    onChange={(d) =>
                      handleInputChange(updateDistribution(input, 'net_to_gross_dist', d))
                    }
                  />
                </div>
              </div>
              <label
                style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '1rem' }}
              >
                GRV–NTG rank correlation (Spearman, −1 to 1; 0 = independent)
                <NumericInput
                  allowEmpty={false}
                  value={input.grv_ntg_correlation ?? 0}
                  onChange={(v) => {
                    if (v != null) patch({ grv_ntg_correlation: Math.min(1, Math.max(-1, v)) })
                  }}
                />
              </label>
            </>
          ) : (
            <>
              <h3>Net rock volume (Direct NRV)</h3>
              <RockVolumeDistributionForm
                canonicalDist={nrvDirect}
                displayUnit={nrvUnit}
                helperText="Use when interpreted NRV already exists. P90 <= P50 <= P10."
                onCommit={(canonical) =>
                  handleInputChange(updateDistribution(input, 'nrv_direct_dist', canonical))
                }
              />

              {input.nrv_direct_multiplier_dist && (
                <>
                  <h3 style={{ marginTop: '1rem' }}>NRV multiplier (optional)</h3>
                  <DistributionInputCard
                    dist={input.nrv_direct_multiplier_dist}
                    helperText="Keep Fixed = 1 for no scaling. Use a variable distribution only when justified."
                    onChange={(d) =>
                      handleInputChange(updateDistribution(input, 'nrv_direct_multiplier_dist', d))
                    }
                  />
                </>
              )}
            </>
          )}
        </div>

        <div className="card">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
          </button>
          {showAdvanced && (
            <>
              <h2 style={{ marginTop: '1rem' }}>3) Advanced</h2>
              <h3>Complex traps (optional)</h3>
              <ComplexTrapsPanel
                input={input}
                displayUnit="acres"
                volumeContext="grv"
                rockVolumeUnit={grvUnit}
                onChange={(next) => {
                  let patched = next
                  if (!input.complex_trap?.enabled && next.complex_trap?.enabled) {
                    patched = withNrvComplexTrapEnabled(next, true)
                  }
                  handleInputChange(patched)
                }}
              />
              {input.cross_check_enabled && (
                <p className="alert warn" style={{ marginTop: '0.5rem' }}>
                  Cross-check and complex trap cannot run together. Turn off cross-check to apply
                  complex trap to NRV.
                </p>
              )}

              <h3 style={{ marginTop: '1rem' }}>Area-net pay cross-check (optional)</h3>
              <label className="radio-row">
                <input
                  type="checkbox"
                  checked={Boolean(input.cross_check_enabled)}
                  onChange={(e) => patch({ cross_check_enabled: e.target.checked })}
                />
                Enable area-NP cross-check
              </label>

              {input.cross_check_enabled && (
                <>
                  <p className="convention-inline">
                    Cross-check area unit: <strong>{areaInputUnitLabel(input.area_input_unit)}</strong>
                  </p>
                  <AreaDistributionForm
                    canonicalDist={ccArea}
                    displayUnit={areaDisplayUnit}
                    onCommit={(canonical) =>
                      handleInputChange(updateDistribution(input, 'cross_check_area_dist', canonical))
                    }
                  />
                </>
              )}
            </>
          )}
        </div>

        <div className="card">
          <h2>4) NRV results</h2>
          <ModuleQcSection
            scope="nrv"
            title="NRV preview - histogram and percentiles"
            hint="Run NRV simulation for this tab only. Full-case run is on Simulation."
            rockVolumeUnit={reportVolumeUnit}
            statusNote={ctStatus}
          />

          {input.cross_check_enabled && (
            <div style={{ marginTop: '0.75rem' }}>
              <h3>Cross-check results</h3>
              {nrvPreview?.summaries?.implied_net_pay_ft ? (
                <ModuleSummariesCard
                  preview={nrvPreview}
                  keys={['implied_net_pay_ft']}
                  title="Implied net pay (NRV / cross-check area)"
                />
              ) : (
                <p className="muted">Run NRV simulation to populate cross-check results.</p>
              )}
              {crossWarnings && crossWarnings.length > 0 && (
                <div className="alert warn">
                  <ul>
                    {crossWarnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <ValidateBar />

        <div className="btn-row">
          <Link to="/prospect">
            <button type="button">← Prospect Setup</button>
          </Link>
          <Link to="/hc-yield">
            <button type="button" className="primary">
              Next: HC Yield →
            </button>
          </Link>
        </div>
      </WorkflowGate>
    </div>
  )
}
