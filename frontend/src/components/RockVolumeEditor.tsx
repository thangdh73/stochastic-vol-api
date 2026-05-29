import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AreaDistributionForm } from './AreaDistributionForm'
import { ComplexTrapsPanel } from './ComplexTrapsPanel'
import { DistributionPercentilesTable } from './DistributionPercentilesTable'
import { ModuleQcSection } from './ModuleQcSection'
import { ModuleSummariesCard } from './ModuleSummariesCard'
import { NumericInput } from './NumericInput'
import { RockVolumeDistributionForm } from './RockVolumeDistributionForm'
import { rockVolumeInputUnitLabel } from '../constants/inputUnits'
import { useWorkflow } from '../context/WorkflowContext'
import type { NrvEntryMode, RockVolumeInputUnit } from '../types/api'
import { ensureNrvDistributions } from '../utils/defaultInput'
import { effectiveEstimatingMethod } from '../utils/estimatingMethod'
import { areaChartUnitFromInput } from '../utils/inputDisplayUnits'
import { updateDistribution } from '../utils/inputHelpers'
import { complexTrapStatusMessage, withNrvComplexTrapEnabled } from '../utils/nrvComplexTrap'
import { formatDistShort, formatDistTypeLabel } from '../utils/distSummary'
import { tankCode } from '../utils/tankLabels'
import { PetrelGrvMarginalsPanel } from './PetrelGrvMarginalsPanel'
import { RockVolumeEntryModePicker, rockVolumeModeLabel } from './RockVolumeEntryModePicker'
import { ensurePetrelGrvMarginals } from '../utils/petrelGrv'

type RockVolumeEditorProps = {
  /** Collapse editor after user finishes editing distributions. */
  onDone?: () => void
}

/** Collapsed strip: summary only until user clicks Edit. */
export function RockVolumeEditorCollapsed({
  onOpen,
  onPatch,
}: {
  onOpen: () => void
  onPatch: (next: NonNullable<ReturnType<typeof useWorkflow>['input']>) => void
}) {
  const { input, setInput, petroConstants, reservoirs, segments, activeReservoirId, activeSegmentId } =
    useWorkflow()

  if (!input) return null

  const method = effectiveEstimatingMethod(input)
  if (method !== 'nrv_grv_yield') {
    return (
      <div className="card input-editor-collapsed">
        <p className="muted" style={{ margin: 0 }}>
          Rock volume editing requires the GRV/NRV method on Setup.
        </p>
      </div>
    )
  }

  const reservoirIndex = reservoirs.findIndex((r) => r.id === activeReservoirId)
  const segmentIndex = segments.findIndex((s) => s.id === activeSegmentId)
  const ntgConstant = petroConstants.ntg
  const entryMode = input.nrv_entry_mode ?? 'grv_fill_ntg'
  const petrelMode = entryMode === 'petrel_marginals'
  const directMode = entryMode === 'direct' || (ntgConstant && !petrelMode)

  const tankLabel =
    reservoirIndex >= 0 && segmentIndex >= 0
      ? tankCode(reservoirIndex, segmentIndex)
      : 'Active tank'

  const summaryItems = directMode
    ? [{ label: 'NRV', value: formatDistShort(input.nrv_direct_dist) }]
    : petrelMode && input.petrel_grv_marginals
      ? [
          {
            label: 'Structure GRV',
            value: input.petrel_grv_marginals.depth_grv.map((v) => v.toLocaleString()).join(' / '),
          },
          {
            label: 'Contact GRV',
            value: input.petrel_grv_marginals.contact_grv.map((v) => v.toLocaleString()).join(' / '),
          },
        ]
      : [
          { label: 'GRV', value: formatDistShort(input.grv_dist) },
          { label: 'Fill', value: formatDistShort(input.grv_percent_fill_dist) },
        ]

  return (
    <div className="card input-editor-collapsed">
      <div className="input-editor-collapsed-inner">
        <div className="input-editor-collapsed-text">
          <h2 className="input-editor-title">{tankLabel} — rock volume</h2>
          <p className="input-editor-mode-badge">
            Mode: <strong>{rockVolumeModeLabel(entryMode)}</strong>
          </p>
          <RockVolumeEntryModePicker
            input={input}
            ntgConstantOnSetup={ntgConstant}
            onPatch={(next) => {
              setInput(next)
              onPatch(next)
              if (next.nrv_entry_mode === 'petrel_marginals') onOpen()
            }}
            compact
          />
          <dl className="input-editor-summary-dl">
            {summaryItems.map(({ label, value }) => {
              const dist =
                label === 'GRV'
                  ? input.grv_dist
                  : label === 'Fill'
                    ? input.grv_percent_fill_dist
                      : input.nrv_direct_dist
              return (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {value}
                    {dist && (
                      <span className="input-editor-summary-type">
                        {' '}
                        ({formatDistTypeLabel(dist)})
                      </span>
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>
        <button type="button" className="input-editor-open-btn" onClick={onOpen}>
          Edit distributions
        </button>
      </div>
    </div>
  )
}

/** Active-tank rock volume distributions (GRV × fill × NTG or direct NRV). */
export function RockVolumeEditor({ onDone }: RockVolumeEditorProps) {
  const { input, setInput, getModulePreview, setModulePreview, petroConstants } = useWorkflow()
  const ntgConstantOnSetup = petroConstants.ntg
  const [showPreview, setShowPreview] = useState(false)
  const nrvPreview = getModulePreview('nrv')
  const crossWarnings = nrvPreview?.metadata?.cross_check_warnings as string[] | undefined

  useEffect(() => {
    if (!input) return
    if (effectiveEstimatingMethod(input) !== 'nrv_grv_yield') return
    if (input.nrv_entry_mode === 'petrel_marginals') {
      if (!input.petrel_grv_marginals || !input.net_to_gross_dist) {
        setInput(ensurePetrelGrvMarginals(ensureNrvDistributions(input)))
      }
      return
    }
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

  if (!input) return null

  const method = effectiveEstimatingMethod(input)
  if (method !== 'nrv_grv_yield') {
    return (
      <div className="alert warn">
        Rock volume editing requires the GRV/NRV method. Adjust on{' '}
        <Link to="/setup/overview">Setup</Link>.
      </div>
    )
  }

  const entryMode: NrvEntryMode = input.nrv_entry_mode ?? 'grv_fill_ntg'
  const grvUnit: RockVolumeInputUnit = input.grv_input_unit ?? 'acre_ft'
  const grv = input.grv_dist
  const fill = input.grv_percent_fill_dist
  const nrvDirect = input.nrv_direct_dist!
  const ccArea = input.cross_check_area_dist!
  const nrvUnit: RockVolumeInputUnit = input.nrv_input_unit ?? 'acre_ft'
  const petrelMode = entryMode === 'petrel_marginals'
  const directMode = entryMode === 'direct' || (ntgConstantOnSetup && !petrelMode)
  const reportVolumeUnit = entryMode === 'direct' ? nrvUnit : grvUnit
  const areaDisplayUnit = areaChartUnitFromInput(input)
  const ctStatus = complexTrapStatusMessage(input, nrvPreview?.metadata)

  const handleInputChange = (next: typeof input) => {
    const ctWas = input.complex_trap?.enabled
    const ctNow = next.complex_trap?.enabled
    const ctCaps =
      input.complex_trap?.element_1?.max_area_acres !==
        next.complex_trap?.element_1?.max_area_acres ||
      input.complex_trap?.element_2?.max_area_acres !==
        next.complex_trap?.element_2?.max_area_acres
    if (ctWas !== ctNow || ctCaps) setModulePreview('nrv', null)
    setInput(next)
  }

  const patch = (partial: Partial<typeof input>) => handleInputChange({ ...input, ...partial })

  return (
    <div className="rock-volume-editor">
      <div className="card input-editor-card">
        <div className="input-editor-card-head">
          <h2 className="input-editor-title">Active tank — rock volume</h2>
          <div className="input-editor-head-actions">
            <RockVolumeEntryModePicker
              input={input}
              ntgConstantOnSetup={ntgConstantOnSetup}
              onPatch={handleInputChange}
            />
            {onDone && (
              <button type="button" className="input-editor-done-btn" onClick={onDone}>
                Done
              </button>
            )}
          </div>
        </div>

        {ntgConstantOnSetup && !petrelMode && (
          <p className="convention-inline muted">
            NTG is constant on Setup — use <strong>Direct NRV</strong> or{' '}
            <strong>Petrel GRV (3+3)</strong> then fixed NTG is applied (
            {rockVolumeInputUnitLabel(nrvUnit)}).
          </p>
        )}

        {petrelMode ? (
          <>
            <PetrelGrvMarginalsPanel
              input={input}
              unit={grvUnit}
              onChange={handleInputChange}
            />
          </>
        ) : !directMode ? (
          <>
            <div className="nrv-core-grid">
              <div className="nrv-core-block">
                <h3>GRV</h3>
                <RockVolumeDistributionForm
                  canonicalDist={grv!}
                  displayUnit={grvUnit}
                  helperText="Depth / structure (P90 ≤ P50 ≤ P10)."
                  onCommit={(canonical) =>
                    handleInputChange(updateDistribution(input, 'grv_dist', canonical))
                  }
                />
              </div>
              <div className="nrv-core-block">
                <h3>Trap fill</h3>
                <DistributionPercentilesTable
                  dist={fill!}
                  rowLabel="Trap fill"
                  helperText="Pinchout / fluid contact (fraction 0–1)."
                  onChange={(d) =>
                    handleInputChange(updateDistribution(input, 'grv_percent_fill_dist', d))
                  }
                />
              </div>
            </div>
            <label className="input-inline-field">
              GRV–NTG ρ
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
          <RockVolumeDistributionForm
            canonicalDist={nrvDirect}
            displayUnit={nrvUnit}
            helperText="Combined NRV from external workflow. P90 ≤ P50 ≤ P10."
            onCommit={(canonical) =>
              handleInputChange(updateDistribution(input, 'nrv_direct_dist', canonical))
            }
          />
        )}
      </div>

      <details className="input-details-panel">
        <summary>Advanced (complex trap, cross-check)</summary>
        <div className="input-details-body">
          <h3>Complex traps</h3>
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
          <h3 style={{ marginTop: '1rem' }}>Area–net pay cross-check</h3>
          <label className="radio-row">
            <input
              type="checkbox"
              checked={Boolean(input.cross_check_enabled)}
              onChange={(e) => patch({ cross_check_enabled: e.target.checked })}
            />
            Enable cross-check
          </label>
          {input.cross_check_enabled && (
            <AreaDistributionForm
              canonicalDist={ccArea}
              displayUnit={areaDisplayUnit}
              onCommit={(canonical) =>
                handleInputChange(updateDistribution(input, 'cross_check_area_dist', canonical))
              }
            />
          )}
        </div>
      </details>

      <details
        className="input-details-panel"
        open={showPreview}
        onToggle={(e) => setShowPreview((e.target as HTMLDetailsElement).open)}
      >
        <summary>Preview &amp; QC (this tank)</summary>
        <div className="input-details-body">
          <ModuleQcSection
            scope="nrv"
            title="NRV preview"
            hint="Tab-scoped preview only. Full case: Output → Simulation."
            rockVolumeUnit={reportVolumeUnit}
            statusNote={ctStatus}
          />
          {input.cross_check_enabled && nrvPreview?.summaries?.implied_net_pay_ft && (
            <ModuleSummariesCard
              preview={nrvPreview}
              keys={['implied_net_pay_ft']}
              title="Implied net pay"
            />
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
      </details>

      {onDone && (
        <div className="input-editor-footer-actions">
          <button type="button" className="input-editor-done-btn" onClick={onDone}>
            Done
          </button>
        </div>
      )}
    </div>
  )
}
