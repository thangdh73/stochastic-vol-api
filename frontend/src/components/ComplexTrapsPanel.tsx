import { useState } from 'react'
import type { AreaChartUnit } from './charts/AreaWorkbookCharts'
import { LEGACY_WORKBOOK_LABEL } from '../constants/appBranding'
import {
  helpKeyFor,
  type ComplexTrapHelpKey,
} from '../constants/complexTrapHelp'
import type { RockVolumeInputUnit } from '../constants/inputUnits'
import { rockVolumeInputUnitLabel } from '../constants/inputUnits'
import type { ComplexTrapConfig, SimulationInput } from '../types/api'
import { acresToSqKm, sqKmToAcres } from '../constants/units'
import {
  rockVolumeScalarToCanonical,
  rockVolumeScalarToDisplay,
} from '../utils/rockVolumeUnits'
import { ComplexTrapHelpModal } from './ComplexTrapHelpModal'
import { NumericInput } from './NumericInput'

interface ComplexTrapsPanelProps {
  input: SimulationInput
  displayUnit: AreaChartUnit
  onChange: (input: SimulationInput) => void
  /** When grv, max caps are labelled as GRV for NRV workflow. */
  volumeContext?: 'area' | 'grv'
  rockVolumeUnit?: RockVolumeInputUnit
}

function displayMax(
  acres: number,
  unit: AreaChartUnit,
): number {
  return unit === 'sq_km' ? acresToSqKm(acres) : acres
}

function canonicalMax(value: number, unit: AreaChartUnit): number {
  return unit === 'sq_km' ? sqKmToAcres(value) : value
}

function displayMaxVolume(
  canonicalAcreFt: number,
  unit: RockVolumeInputUnit,
): number {
  return rockVolumeScalarToDisplay(canonicalAcreFt, unit)
}

function canonicalMaxVolume(value: number, unit: RockVolumeInputUnit): number {
  return rockVolumeScalarToCanonical(value, unit)
}

function closedAreaAcres(input: SimulationInput): number | null {
  const d = input.area_dist
  if (!d) return null
  if (d.distribution_type === 'fixed' && d.fixed_value != null) {
    return d.fixed_value
  }
  if (d.p50 != null) return d.p50
  return null
}

export function ComplexTrapsPanel({
  input,
  displayUnit,
  onChange,
  volumeContext = 'area',
  rockVolumeUnit = 'acre_ft',
}: ComplexTrapsPanelProps) {
  const rvUnitLabel = rockVolumeInputUnitLabel(rockVolumeUnit)
  const maxLabel =
    volumeContext === 'grv'
      ? `Max GRV (${rvUnitLabel})`
      : `Max area (${displayUnit === 'sq_km' ? 'sq km' : 'acres'})`
  const ct: ComplexTrapConfig = input.complex_trap ?? {
    enabled: false,
    method: 'A',
    num_elements: 1,
    element_1: { enabled: true, max_area_acres: 2000, seal_confidence: 0.5 },
    element_2: { enabled: false, max_area_acres: 4000, seal_confidence: 0.8 },
  }

  const patchCt = (partial: Partial<ComplexTrapConfig>) => {
    onChange({ ...input, complex_trap: { ...ct, ...partial } })
  }

  const patchEl = (
    which: 'element_1' | 'element_2',
    partial: Partial<ComplexTrapConfig['element_1']>,
  ) => {
    patchCt({ [which]: { ...ct[which], ...partial } })
  }

  const [helpOpen, setHelpOpen] = useState(false)
  const [helpKey, setHelpKey] = useState<ComplexTrapHelpKey>(() =>
    helpKeyFor(ct.method, ct.num_elements),
  )

  const openHelp = (key?: ComplexTrapHelpKey) => {
    setHelpKey(key ?? helpKeyFor(ct.method, ct.num_elements))
    setHelpOpen(true)
  }

  const closed = closedAreaAcres(input)
  const unit = displayUnit === 'sq_km' ? 'sq km' : 'acres'
  const cap1 = ct.element_1.max_area_acres
  const ratio =
    closed != null && cap1 > 0
      ? volumeContext === 'grv'
        ? `${displayMaxVolume(cap1, rockVolumeUnit).toFixed(0)} (element 1 max)`
        : `${closed.toFixed(0)}/${displayMax(cap1, displayUnit).toFixed(0)}`
      : '—'

  return (
    <div className="complex-traps-panel">
      <div className="ct-panel-title-row">
        <h2>Complex Traps</h2>
        <button
          type="button"
          className="btn-secondary ct-help-open"
          onClick={() => openHelp()}
          title="Open workbook diagrams for Method A / B"
        >
          How it works
        </button>
      </div>
      <p className="convention-inline">
        {volumeContext === 'grv'
          ? `Model downdip trap elements on GRV (workbook Method A), then NRV = GRV × fill × NTG.`
          : `Model downdip trap elements on closed area (Method A or B), then productive area = closed × fill.`}{' '}
        Logic follows the {LEGACY_WORKBOOK_LABEL}.
      </p>

      <ComplexTrapHelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        selectedKey={helpKey}
        onSelectKey={setHelpKey}
      />

      <label className="radio-row">
        <input
          type="checkbox"
          checked={ct.enabled}
          onChange={(e) => patchCt({ enabled: e.target.checked })}
        />
        Enable complex trap extension
      </label>

      {ct.enabled && (
        <>
          <fieldset className="ct-fieldset">
            <legend>Elements to model</legend>
            <label className="radio-row">
              <input
                type="radio"
                name="ct-num"
                checked={ct.num_elements === 1}
                onChange={() =>
                  patchCt({ num_elements: 1, element_1: { ...ct.element_1, enabled: true } })
                }
              />
              1st CT element only
            </label>
            <label className="radio-row">
              <input
                type="radio"
                name="ct-num"
                checked={ct.num_elements >= 2}
                onChange={() =>
                  patchCt({
                    num_elements: 2,
                    element_1: { ...ct.element_1, enabled: true },
                    element_2: { ...ct.element_2, enabled: true },
                  })
                }
              />
              1st and 2nd CT elements
            </label>
            <p className="convention-inline">
              {volumeContext === 'grv'
                ? `Set element caps between GRV P90 and P10 (${rvUnitLabel}). Caps far outside your GRV range have little or no effect.`
                : `Closed area inputs are ${ratio} (${unit} / element 1 max)`}
            </p>
          </fieldset>

          <fieldset className="ct-fieldset">
            <legend>Calculation method</legend>
            <label className="radio-row">
              <input
                type="radio"
                name="ct-method"
                checked={ct.method === 'A'}
                onChange={() => patchCt({ method: 'A' })}
              />
              A: Log-rescale to element caps by seal outcome (workbook default)
              <button
                type="button"
                className="ct-help-inline"
                onClick={(e) => {
                  e.preventDefault()
                  openHelp(helpKeyFor('A', ct.num_elements))
                }}
              >
                Diagram
              </button>
            </label>
            {volumeContext !== 'grv' && (
              <label className="radio-row">
                <input
                  type="radio"
                  name="ct-method"
                  checked={ct.method === 'B'}
                  onChange={() => patchCt({ method: 'B' })}
                />
                B: Truncate at element max when sample exceeds cap and seal fails
                <button
                  type="button"
                  className="ct-help-inline"
                  onClick={(e) => {
                    e.preventDefault()
                    openHelp(helpKeyFor('B', ct.num_elements))
                  }}
                >
                  Diagram
                </button>
              </label>
            )}
          </fieldset>

          <p className="ct-question">
            {volumeContext === 'grv'
              ? `GRV updip from the additional complex trap element (${rvUnitLabel})`
              : `Closed area updip from the additional complex trap element (${unit})`}
          </p>

          <div className="ct-elements-grid">
            <div className={`ct-element-card ${ct.num_elements >= 1 ? '' : 'disabled'}`}>
              <h3>1st CT element (highest)</h3>
              <p className="chart-caption">Max size if element 1 seals alone</p>
              <label>
                {maxLabel}
                <NumericInput
                  allowEmpty={false}
                  value={
                    volumeContext === 'grv'
                      ? displayMaxVolume(ct.element_1.max_area_acres, rockVolumeUnit)
                      : displayMax(ct.element_1.max_area_acres, displayUnit)
                  }
                  onChange={(v) =>
                    patchEl('element_1', {
                      max_area_acres:
                        volumeContext === 'grv'
                          ? canonicalMaxVolume(v ?? 0, rockVolumeUnit)
                          : canonicalMax(v ?? 0, displayUnit),
                      enabled: true,
                    })
                  }
                />
              </label>
              <label>
                Seal confidence (%)
                <NumericInput
                  allowEmpty={false}
                  asPercent
                  value={ct.element_1.seal_confidence}
                  onChange={(v) =>
                    patchEl('element_1', {
                      seal_confidence: Math.min(1, Math.max(0, v ?? 0)),
                      enabled: true,
                    })
                  }
                />
              </label>
            </div>

            <div
              className={`ct-element-card ${ct.num_elements >= 2 ? '' : 'disabled'}`}
            >
              <h3>2nd CT element (lowest)</h3>
              <p className="chart-caption">Max size if both elements seal</p>
              <label>
                {maxLabel}
                <NumericInput
                  allowEmpty={false}
                  disabled={ct.num_elements < 2}
                  value={
                    volumeContext === 'grv'
                      ? displayMaxVolume(ct.element_2.max_area_acres, rockVolumeUnit)
                      : displayMax(ct.element_2.max_area_acres, displayUnit)
                  }
                  onChange={(v) =>
                    patchEl('element_2', {
                      max_area_acres:
                        volumeContext === 'grv'
                          ? canonicalMaxVolume(v ?? 0, rockVolumeUnit)
                          : canonicalMax(v ?? 0, displayUnit),
                      enabled: ct.num_elements >= 2,
                    })
                  }
                />
              </label>
              <label>
                Seal confidence (%)
                <NumericInput
                  allowEmpty={false}
                  asPercent
                  disabled={ct.num_elements < 2}
                  value={ct.element_2.seal_confidence}
                  onChange={(v) =>
                    patchEl('element_2', {
                      seal_confidence: Math.min(1, Math.max(0, v ?? 0)),
                      enabled: ct.num_elements >= 2,
                    })
                  }
                />
              </label>
            </div>
          </div>

          <div className="ct-diagram-hint">
            <strong>Method A logic:</strong>
            <ul>
              <li>Updip minimum = closed area × percent fill (fixed).</li>
              <li>
                P(element 1 seals): sample area between minimum and element 1 max.
              </li>
              {ct.num_elements >= 2 && (
                <li>
                  If element 1 seals: P(element 2 seals) → up to element 2 max; else
                  capped at element 1 max.
                </li>
              )}
              <li>If element 1 leaks: productive area = updip minimum only.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
