import { useEffect, useState } from 'react'
import { DistributionInputCard } from './DistributionInputCard'
import { DistributionPercentilesTable } from './DistributionPercentilesTable'
import { ModuleQcSection } from './ModuleQcSection'
import { useWorkflow } from '../context/WorkflowContext'
import {
  applyOilRecovery,
  includeSolutionGas,
  setApplyOilRecovery,
  setIncludeSolutionGas,
} from '../utils/calculationToggles'
import { updateDistribution, type DistKey } from '../utils/inputHelpers'
import { hcYieldTableColumns, tankShowsNtgColumn } from '../utils/hcYieldControlColumns'
import { pickSharedHcYieldFields } from '../utils/tankHcYieldShared'
import { tankCode } from '../utils/tankLabels'

type Props = {
  onDone?: () => void
}

/** Active-tank distribution editor (main params + secondary recovery/GOR). */
export function HcYieldActiveTankEditor({ onDone }: Props) {
  const {
    input,
    setInput,
    setModulePreview,
    petEvaluationEnabled,
    reservoirs,
    segments,
    activeReservoirId,
    activeSegmentId,
    petroConstants,
  } = useWorkflow()
  const [showPreview, setShowPreview] = useState(false)

  const isGas = input?.fluid_type === 'gas' || input?.fluid_type === 'gas_condensate'

  const handleInputChange = (next: NonNullable<typeof input>) => {
    if (!input) {
      setInput(next)
      return
    }
    const hcKeys = Object.keys(pickSharedHcYieldFields(input)) as (keyof typeof input)[]
    const hcChanged = hcKeys.some((k) => input[k] !== next[k])
    if (hcChanged) setModulePreview('hc_yield', null)
    setInput(next)
  }

  useEffect(() => {
    if (!input || isGas) return
    if (!applyOilRecovery(input) && input.apply_oil_recovery !== false) {
      setInput(setApplyOilRecovery(input, false))
    }
  }, [input, isGas, setInput])

  if (!input) return null

  const reservoirIndex = reservoirs.findIndex((r) => r.id === activeReservoirId)
  const segmentIndex = segments.findIndex((s) => s.id === activeSegmentId)
  const tankLabel =
    reservoirIndex >= 0 && segmentIndex >= 0
      ? tankCode(reservoirIndex, segmentIndex)
      : 'Active tank'

  const oilExtraFields: { key: DistKey; asPercent?: boolean; show: boolean; title: string }[] = [
    { key: 'oil_recovery_dist', asPercent: true, show: !isGas && applyOilRecovery(input), title: 'Oil recovery' },
    { key: 'gor_dist', show: !isGas && includeSolutionGas(input), title: 'GOR' },
    {
      key: 'solution_gas_recovery_dist',
      asPercent: true,
      show: !isGas && includeSolutionGas(input),
      title: 'Solution gas recovery',
    },
  ]

  const gasExtraFields: { key: DistKey; asPercent?: boolean; title: string }[] = [
    { key: 'gas_recovery_dist', asPercent: true, title: 'Gas recovery' },
  ]
  if (input.fluid_type === 'gas_condensate') {
    gasExtraFields.push({ key: 'condensate_yield_dist', title: 'Condensate yield' })
  }

  const anyTankNtg = tankShowsNtgColumn(petroConstants, input)
  const mainColumns = hcYieldTableColumns(input, anyTankNtg)

  return (
    <div className="card input-editor-card hc-yield-active-editor">
      <div className="input-editor-card-head">
        <h2 className="input-editor-title">{tankLabel} — distributions</h2>
        {onDone && (
          <button type="button" className="input-editor-done-btn" onClick={onDone}>
            Done
          </button>
        )}
      </div>

      <p className="convention-inline muted">
        Edit distributions for the selected tank. The QC table above updates when you change values
        here or via CSV import.
      </p>

      <div className="hc-yield-main-dist-grid">
        {mainColumns.map((col) => {
          const dist = input[col.key]
          if (!dist || typeof dist !== 'object' || !('distribution_type' in dist)) return null
          if (col.key === 'net_to_gross_dist' && !anyTankNtg) return null
          return (
            <div className="nrv-core-block" key={col.key}>
              <h3>{col.label}</h3>
              <DistributionPercentilesTable
                dist={dist}
                rowLabel={col.label}
                asPercent={col.asPercent}
                showQcHistogram
                parameterTitle={col.label}
                nIterations={input.n_iterations}
                seed={input.seed}
                variableKind={
                  col.key === 'porosity_dist' ||
                  col.key === 'saturation_dist' ||
                  col.key === 'net_to_gross_dist'
                    ? 'fraction'
                    : 'positive_resource'
                }
                onChange={(d) => handleInputChange(updateDistribution(input, col.key, d))}
              />
            </div>
          )
        })}
      </div>

      {!isGas && (
        <details className="input-details-panel">
          <summary>Calculation options (oil)</summary>
          <div className="input-details-body">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={includeSolutionGas(input)}
                onChange={(e) => handleInputChange(setIncludeSolutionGas(input, e.target.checked))}
              />
              Include solution gas (GOR)
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={applyOilRecovery(input)}
                onChange={(e) => handleInputChange(setApplyOilRecovery(input, e.target.checked))}
              />
              Apply oil recovery factor
            </label>
            {!applyOilRecovery(input) && (
              <p className="alert warn" style={{ marginTop: '0.5rem' }}>
                Recovery off: recoverable oil equals STOIIP (in-place proxy).
              </p>
            )}
          </div>
        </details>
      )}

      <details className="input-details-panel">
        <summary>Secondary parameters (recovery, GOR, …)</summary>
        <div className="input-details-body">
          <div className="hc-yield-dist-grid">
            {(isGas ? gasExtraFields : oilExtraFields.filter((f) => f.show)).map(
              ({ key, asPercent, title }) => {
                const dist = input[key]
                if (!dist) return null
                return (
                  <div className="card input-dist-card" key={key}>
                    <h3 style={{ marginTop: 0 }}>{title}</h3>
                    <DistributionInputCard
                      dist={dist}
                      onChange={(d) => handleInputChange(updateDistribution(input, key, d))}
                      asPercent={asPercent}
                    />
                  </div>
                )
              },
            )}
          </div>
        </div>
      </details>

      {petEvaluationEnabled && (
        <div className="card input-dist-card">
          <h3 style={{ marginTop: 0 }}>PET Evaluation</h3>
          {input.pet_evaluation_dist ? (
            <DistributionInputCard
              dist={input.pet_evaluation_dist}
              onChange={(d) =>
                handleInputChange(updateDistribution(input, 'pet_evaluation_dist', d))
              }
            />
          ) : (
            <p className="muted">Enable PET Evaluation on Setup → Overview.</p>
          )}
        </div>
      )}

      <details
        className="input-details-panel"
        open={showPreview}
        onToggle={(e) => setShowPreview((e.target as HTMLDetailsElement).open)}
      >
        <summary>Preview &amp; QC (this tank)</summary>
        <div className="input-details-body">
          <ModuleQcSection scope="hc_yield" title="HC yield preview" />
        </div>
      </details>
    </div>
  )
}
