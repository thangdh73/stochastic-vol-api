import { NumericInput } from './NumericInput'
import { rockVolumeInputUnitLabel } from '../constants/inputUnits'
import type { PetrelGrvMarginals, RockVolumeInputUnit } from '../types/api'
import {
  PETREL_CASE_LABELS,
  buildPetrelGrvMatrix,
  patchPetrelMarginals,
  updatePetrelCaseValue,
} from '../utils/petrelGrv'
import type { SimulationInput } from '../types/api'

type Props = {
  input: SimulationInput
  unit: RockVolumeInputUnit
  onChange: (next: SimulationInput) => void
}

function CaseRow({
  label,
  values,
  weights,
  onValue,
  onWeight,
}: {
  label: string
  values: [number, number, number]
  weights: [number, number, number]
  onValue: (index: number, value: number | null) => void
  onWeight: (index: number, value: number | null) => void
}) {
  return (
    <tr>
      <th scope="row">{label}</th>
      {PETREL_CASE_LABELS.map((caseLabel, i) => (
        <td key={caseLabel}>
          <span className="petrel-case-label">{caseLabel}</span>
          <NumericInput allowEmpty={false} value={values[i]} onChange={(v) => onValue(i, v)} />
          <label className="petrel-weight-label">
            wt
            <NumericInput
              allowEmpty={false}
              value={weights[i]}
              onChange={(v) => onWeight(i, v)}
              style={{ width: '4.5rem', marginLeft: '0.25rem' }}
            />
          </label>
        </td>
      ))}
    </tr>
  )
}

export function PetrelGrvMarginalsPanel({ input, unit, onChange }: Props) {
  const pm: PetrelGrvMarginals =
    input.petrel_grv_marginals ??
    ({
      depth_grv: [8000, 10000, 12000],
      contact_grv: [9000, 10000, 11000],
      depth_weights: [1 / 3, 1 / 3, 1 / 3],
      contact_weights: [1 / 3, 1 / 3, 1 / 3],
    } as PetrelGrvMarginals)

  const depthWeights = pm.depth_weights ?? [1 / 3, 1 / 3, 1 / 3]
  const contactWeights = pm.contact_weights ?? [1 / 3, 1 / 3, 1 / 3]

  let matrix: number[][] | null = null
  try {
    matrix = buildPetrelGrvMatrix(pm)
  } catch {
    matrix = null
  }

  const patchPm = (partial: Partial<PetrelGrvMarginals>) => {
    onChange(patchPetrelMarginals(input, partial))
  }

  return (
    <div className="petrel-grv-panel">
      <p className="convention-inline muted">
        Paste <strong>three GRV values from Petrel structural cases</strong> (fixed mid fluid contact)
        and <strong>three from fluid-contact cases</strong> (fixed mid structure). Units:{' '}
        <strong>{rockVolumeInputUnitLabel(unit)}</strong>. Each Monte Carlo draw picks one depth
        case and one contact case; GRV is taken from the derived 3×3 matrix. Tornado shows separate{' '}
        <strong>Depth / structure</strong> and <strong>Fluid contact</strong> bars.
      </p>

      <table className="data-table petrel-grv-input-table">
        <thead>
          <tr>
            <th />
            {PETREL_CASE_LABELS.map((l) => (
              <th key={l}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <CaseRow
            label="Structure (depth)"
            values={pm.depth_grv}
            weights={depthWeights}
            onValue={(i, v) => {
              if (v == null) return
              patchPm(updatePetrelCaseValue(pm, 'depth', i, v))
            }}
            onWeight={(i, v) => {
              if (v == null) return
              const w = [...depthWeights] as [number, number, number]
              w[i] = v
              patchPm({ depth_weights: w })
            }}
          />
          <CaseRow
            label="Fluid contact"
            values={pm.contact_grv}
            weights={contactWeights}
            onValue={(i, v) => {
              if (v == null) return
              patchPm(updatePetrelCaseValue(pm, 'contact', i, v))
            }}
            onWeight={(i, v) => {
              if (v == null) return
              const w = [...contactWeights] as [number, number, number]
              w[i] = v
              patchPm({ contact_weights: w })
            }}
          />
        </tbody>
      </table>

      {matrix && (
        <div className="petrel-matrix-preview">
          <h4>Derived GRV matrix (depth × contact)</h4>
          <table className="data-table petrel-matrix-table">
            <thead>
              <tr>
                <th />
                <th>Contact P90</th>
                <th>Contact P50</th>
                <th>Contact P10</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, ri) => (
                <tr key={PETREL_CASE_LABELS[ri]}>
                  <th scope="row">{PETREL_CASE_LABELS[ri]}</th>
                  {row.map((cell, ci) => (
                    <td key={ci}>{cell.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
