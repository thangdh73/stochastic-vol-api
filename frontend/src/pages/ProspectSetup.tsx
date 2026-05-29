import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { NumericInput } from '../components/NumericInput'
import { WorkflowGate } from '../components/WorkflowGate'
import { ReservoirSegmentManager } from '../components/ReservoirSegmentManager'
import { useWorkflow } from '../context/WorkflowContext'
import type {
  GasResourceUnit,
  OilResourceUnit,
  RockVolumeInputUnit,
} from '../types/api'
import { ensureGasCondensateFields, ensureNrvDistributions } from '../utils/defaultInput'
import { defaultPertForPetroKey } from '../utils/ensureSimulationReady'
import type { DistributionSpec } from '../types/api'
import {
  applyNtgConstantRockVolumeMode,
  clearNtgConstantRockVolumeMode,
  editorPathForRockVolumeColumn,
  inputPathForGrv,
  isNrvDirectFromNtgConstant,
  PETRO_PARAM_KEYS,
  petroDistributionForKey,
  grvSlotForIndex,
  rockVolumeColumns,
  setupPetroListKeys,
  setupPetroLabelForKey,
  editorPathForSetupPetroKey,
  ensurePetEvaluationDist,
  type PetroParamKey,
  type SetupPetroListKey,
} from '../utils/setupInputParams'

type FormulaId = 'stoiip_sw' | 'giip_sw' | 'stoiip_so' | 'giip_sg'
type FluidFamily = 'oil' | 'gas'
type CompactUnitOption = { value: string; label: string }

const FORMULA_OPTIONS: Array<{
  id: FormulaId
  label: string
  family: FluidFamily
}> = [
  { id: 'stoiip_sw', label: 'STOIIP = GRV.NTG.PORO.(1-Sw)/Bo', family: 'oil' },
  { id: 'giip_sw', label: 'GIIP = GRV.NTG.PORO.(1-Sw)/Bg', family: 'gas' },
  { id: 'stoiip_so', label: 'STOIIP = GRV.NTG.PORO.So/Bo', family: 'oil' },
  { id: 'giip_sg', label: 'GIIP = GRV.NTG.PORO.Sg/Bg', family: 'gas' },
]

const STOIIP_UNIT_OPTIONS: CompactUnitOption[] = [
  { value: 'MMscm', label: 'm^3' },
  { value: 'MMscm', label: '10^6 m^3' },
  { value: 'MMSTB', label: 'bbl' },
  { value: 'MMBO', label: 'Mbbl' },
  { value: 'MMBO', label: 'MMbbl' },
]

const GIIP_UNIT_OPTIONS: CompactUnitOption[] = [
  { value: 'Bscm', label: 'm^3' },
  { value: 'Bscm', label: '10^6 m^3' },
  { value: 'MMSCF', label: 'Mcf' },
  { value: 'MMSCF', label: 'MMcf' },
  { value: 'BCF', label: 'Bcf' },
]

const GRV_UNIT_OPTIONS: Array<{ value: RockVolumeInputUnit; label: string }> = [
  { value: 'm3', label: 'm^3' },
  { value: 'million_m3', label: '10^6 m^3' },
  { value: 'ft3', label: 'ft^3' },
  { value: 'thousand_ft3', label: '10^3 ft^3' },
  { value: 'million_ft3', label: '10^6 ft^3' },
  { value: 'acre_ft', label: 'acre-ft' },
]

export type SetupSection = 'overview' | 'metadata'

export function ProspectSetupPage({ section = 'overview' }: { section?: SetupSection }) {
  const {
    input,
    segments,
    reservoirs,
    activeSegmentId,
    activeReservoirId,
    setInput,
    setActiveSegment,
    setActiveReservoir,
    addSegment,
    removeSegment,
    moveSegment,
    addReservoir,
    removeReservoir,
    moveReservoir,
    renameSegment,
    renameReservoir,
    grvParamLabels,
    renameGrvParamLabel,
    addGrvParamLabel,
    removeGrvParamLabel,
    petroParamLabels,
    setPetroParamLabel,
    petroConstants,
    setPetroConstants,
    petroConstantValues,
    setPetroConstantValues,
    petEvaluationEnabled,
    setPetEvaluationEnabled,
    petEvalLabel,
    setPetEvalLabel,
  } = useWorkflow()
  const [selectedGrvParamIndex, setSelectedGrvParamIndex] = useState<number | null>(0)
  const [editingGrvParamIndex, setEditingGrvParamIndex] = useState<number | null>(null)
  const [editingGrvParamValue, setEditingGrvParamValue] = useState('')
  const [editingParamKey, setEditingParamKey] = useState<SetupPetroListKey | null>(null)
  const [editingParamValue, setEditingParamValue] = useState('')
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null)
  const [editingSegmentValue, setEditingSegmentValue] = useState('')
  const [editingReservoirId, setEditingReservoirId] = useState<string | null>(null)
  const [editingReservoirValue, setEditingReservoirValue] = useState('')
  const [selectedFormula, setSelectedFormula] = useState<FormulaId>('stoiip_sw')

  useEffect(() => {
    if (!input) return
    if (input.estimating_method === 'nrv_grv_yield') return
    setInput(ensureNrvDistributions({ ...input, estimating_method: 'nrv_grv_yield' }))
  }, [input, setInput])

  useEffect(() => {
    if (!input || !petEvaluationEnabled) return
    if (input.pet_evaluation_dist) return
    setInput(ensurePetEvaluationDist(input, petEvalLabel))
  }, [input, petEvaluationEnabled, petEvalLabel, setInput])

  useEffect(() => {
    if (!input) return
    const shouldBeNtgConstant =
      input.nrv_entry_mode === 'direct' &&
      input.net_to_gross_dist?.distribution_type === 'fixed'
    if (shouldBeNtgConstant === petroConstants.ntg) return
    setPetroConstants((prev) => ({ ...prev, ntg: shouldBeNtgConstant }))
    if (shouldBeNtgConstant) {
      const fv = input.net_to_gross_dist?.fixed_value
      if (fv != null) {
        setPetroConstantValues((prev) => ({ ...prev, ntg: fv }))
      }
    }
  }, [
    input,
    input?.nrv_entry_mode,
    input?.net_to_gross_dist?.distribution_type,
    input?.net_to_gross_dist?.fixed_value,
    petroConstants.ntg,
    setPetroConstants,
    setPetroConstantValues,
  ])

  if (!input) {
    return (
      <div>
        <h1 className="page-title">Prospect Setup</h1>
        <WorkflowGate>{null}</WorkflowGate>
      </div>
    )
  }

  const patch = (partial: Partial<typeof input>) => setInput({ ...input, ...partial })

  const petroDistForKey = (key: PetroParamKey) => petroDistributionForKey(input, key)

  const patchPetroDist = (key: SetupPetroListKey, dist: DistributionSpec | null) => {
    switch (key) {
      case 'ntg':
        patch({ net_to_gross_dist: dist })
        break
      case 'poro':
        patch({ porosity_dist: dist })
        break
      case 'sw':
        patch({ saturation_dist: dist })
        break
      case 'bo':
        if (input.fvf_dist) patch({ fvf_dist: dist })
        else patch({ gef_dist: dist })
        break
      case 'pet_eval':
        patch({ pet_evaluation_dist: dist })
        break
      default:
        break
    }
  }

  const togglePetEvaluation = () => {
    const next = !petEvaluationEnabled
    setPetEvaluationEnabled(next)
    if (next && input) {
      setInput(ensurePetEvaluationDist(input, petEvalLabel))
    }
  }

  const togglePetroConstant = (key: PetroParamKey) => {
    const turningOn = !petroConstants[key]
    setPetroConstants((prev) => ({ ...prev, [key]: turningOn }))
    if (editingParamKey === key) {
      setEditingParamKey(null)
      setEditingParamValue('')
    }
    const existing = petroDistForKey(key)
    if (key === 'ntg') {
      if (turningOn) {
        const value = petroConstantValues.ntg ?? existing?.fixed_value ?? existing?.p50 ?? 0.75
        setInput(
          applyNtgConstantRockVolumeMode(input, value, petroParamLabels.ntg),
        )
      } else {
        setInput(clearNtgConstantRockVolumeMode(input))
      }
      return
    }
    if (turningOn) {
      const value = petroConstantValues[key] ?? existing?.fixed_value ?? existing?.p50 ?? 0
      patchPetroDist(key, {
        ...(existing ?? {
          variable_id: key,
          display_name: petroParamLabels[key],
          distribution_type: 'fixed',
        }),
        distribution_type: 'fixed',
        fixed_value: value,
        p90: null,
        p50: null,
        p10: null,
      })
    } else if (existing?.distribution_type === 'fixed') {
      const pert = defaultPertForPetroKey(key)
      patchPetroDist(key, {
        ...existing,
        distribution_type: 'pert',
        fixed_value: null,
        p90: existing.p90 ?? pert.p90,
        p50: existing.p50 ?? pert.p50,
        p10: existing.p10 ?? pert.p10,
      })
    }
  }

  const setConstantValue = (key: PetroParamKey, value: number | null) => {
    setPetroConstantValues((prev) => ({ ...prev, [key]: value }))
    if (!petroConstants[key]) return
    if (key === 'ntg' && value != null) {
      setInput(applyNtgConstantRockVolumeMode(input, value, petroParamLabels.ntg))
      return
    }
    const existing = petroDistForKey(key)
    if (existing && value != null) {
      patchPetroDist(key, { ...existing, fixed_value: value })
    }
  }

  const useNrvDirectRockVolume = isNrvDirectFromNtgConstant(petroConstants, input)
  const activeRockVolumeCols = rockVolumeColumns(grvParamLabels, petroConstants, input)

  const activePetroKeys = setupPetroListKeys(petroConstants, petEvaluationEnabled)

  const beginParamEdit = (key: SetupPetroListKey) => {
    setEditingParamKey(key)
    setEditingParamValue(setupPetroLabelForKey(key, petroParamLabels, petEvalLabel))
  }
  const commitParamEdit = () => {
    if (!editingParamKey) return
    const next = editingParamValue.trim()
    if (next) {
      if (editingParamKey === 'pet_eval') {
        setPetEvalLabel(next)
        if (input.pet_evaluation_dist) {
          patch({
            pet_evaluation_dist: { ...input.pet_evaluation_dist, display_name: next },
          })
        }
      } else {
        setPetroParamLabel(editingParamKey, next)
      }
    }
    setEditingParamKey(null)
    setEditingParamValue('')
  }
  const commitGrvParamEdit = () => {
    if (editingGrvParamIndex == null) return
    const next = editingGrvParamValue.trim()
    if (next) {
      renameGrvParamLabel(editingGrvParamIndex, next)
    }
    setEditingGrvParamIndex(null)
    setEditingGrvParamValue('')
  }
  const addGrvParam = () => {
    const nextIndex = grvParamLabels.length
    addGrvParamLabel()
    setSelectedGrvParamIndex(nextIndex)
  }
  const removeSelectedGrvParam = () => {
    if (selectedGrvParamIndex == null || grvParamLabels.length <= 1) return
    removeGrvParamLabel(selectedGrvParamIndex)
    setSelectedGrvParamIndex((prev) => {
      if (prev == null) return 0
      return prev > 0 ? prev - 1 : 0
    })
  }
  const selectedFormulaOption =
    FORMULA_OPTIONS.find((o) => o.id === selectedFormula) ?? FORMULA_OPTIONS[0]
  const formulaFamily: FluidFamily = selectedFormulaOption.family
  const formulaLabel = formulaFamily === 'gas' ? 'GIIP' : 'STOIIP'
  const formulaUnits = formulaFamily === 'gas' ? GIIP_UNIT_OPTIONS : STOIIP_UNIT_OPTIONS
  const formulaUnitValue =
    formulaFamily === 'gas'
      ? input.gas_resource_unit ?? 'BCF'
      : input.oil_resource_unit ?? 'MMBO'

  const selectFormula = (option: (typeof FORMULA_OPTIONS)[number]) => {
    setSelectedFormula(option.id)
  }

  const showOverview = section === 'overview'
  const showMetadata = section === 'metadata'

  return (
    <div>
      {showOverview && (
      <div className="setup-classic-top">
        <div className="card setup-classic-card">
          <h3>Formula</h3>
          {FORMULA_OPTIONS.map((opt) => (
            <label key={opt.id} className="setup-classic-check">
              <input
                type="radio"
                name="setup-formula"
                checked={selectedFormula === opt.id}
                onChange={() => selectFormula(opt)}
              />
              {opt.label}
            </label>
          ))}
        </div>
        <div className="card setup-classic-card">
          <h3>Units</h3>
          <dl className="setup-classic-kv">
            <dt>{formulaLabel}</dt>
            <dd>
              <select
                value={formulaUnitValue}
                onChange={(e) => {
                  if (formulaFamily === 'gas') {
                    patch({ gas_resource_unit: e.target.value as GasResourceUnit })
                  } else {
                    patch({ oil_resource_unit: e.target.value as OilResourceUnit })
                  }
                }}
              >
                {formulaUnits.map((u, idx) => (
                  <option key={`${u.value}-${idx}`} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </dd>
            <dt>GRV</dt>
            <dd>
              <select
                value={input.grv_input_unit ?? 'acre_ft'}
                onChange={(e) => patch({ grv_input_unit: e.target.value as RockVolumeInputUnit })}
              >
                {GRV_UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </dd>
            <dt>Petrophysical</dt>
            <dd>
              <select value="fraction" disabled>
                <option value="fraction">fraction</option>
              </select>
            </dd>
          </dl>
        </div>
        <div className="card setup-classic-card">
          <h3>Constants</h3>
          <div className="setup-classic-constants">
            {PETRO_PARAM_KEYS.map((key) => (
              <label key={key} className="setup-classic-constant-row">
                <input
                  type="checkbox"
                  checked={petroConstants[key]}
                  onChange={() => togglePetroConstant(key)}
                />
                <span
                  title={
                    key === 'ntg'
                      ? 'Constant NTG: direct NRV entry only (not GRV × fill × NTG in this app)'
                      : undefined
                  }
                >
                  {petroParamLabels[key]}
                </span>
                <NumericInput
                  allowEmpty
                  value={petroConstantValues[key]}
                  disabled={!petroConstants[key]}
                  onChange={(v) => setConstantValue(key, v)}
                />
              </label>
            ))}
          </div>
        </div>
        <div className="card setup-classic-card">
          <h3>User defined reference</h3>
          <dl className="setup-classic-kv">
            <dt>Reference value</dt>
            <dd>
              <input type="text" value="0" readOnly title="Default reference value" />
            </dd>
            <dt>PET Evaluation</dt>
            <dd>
              <button
                type="button"
                className={`pet-toggle ${petEvaluationEnabled ? 'on' : 'off'}`}
                aria-pressed={petEvaluationEnabled}
                onClick={togglePetEvaluation}
              >
                {petEvaluationEnabled ? 'ON' : 'OFF'}
              </button>
            </dd>
          </dl>
        </div>
      </div>
      )}

        {showOverview && (
        <div className="setup-classic-mid">
          <div className="card setup-classic-card">
            <h3>{useNrvDirectRockVolume ? 'Net Rock Volume' : 'GRV Uncertainties'}</h3>
            <div className="setup-classic-dual">
              <ul className="setup-classic-list-box selectable">
                {useNrvDirectRockVolume
                  ? activeRockVolumeCols.map((col) => (
                      <li key="nrv-direct" className="active">
                        <div className="setup-param-row">
                          <span className="setup-param-label">{col.label}</span>
                          <Link
                            to={editorPathForRockVolumeColumn(col, input)}
                            className="setup-param-go"
                            title="Edit distribution"
                          >
                            →
                          </Link>
                        </div>
                      </li>
                    ))
                  : grvParamLabels.map((name, idx) => (
                      <li
                        key={`${name}-${idx}`}
                        className={selectedGrvParamIndex === idx ? 'active' : ''}
                        onClick={() => setSelectedGrvParamIndex(idx)}
                      >
                        {editingGrvParamIndex === idx ? (
                          <div
                            className="setup-param-edit-row"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              autoFocus
                              type="text"
                              value={editingGrvParamValue}
                              onChange={(e) => setEditingGrvParamValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitGrvParamEdit()
                                if (e.key === 'Escape') {
                                  setEditingGrvParamIndex(null)
                                  setEditingGrvParamValue('')
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="btn-secondary setup-param-apply"
                              onClick={commitGrvParamEdit}
                            >
                              Apply
                            </button>
                          </div>
                        ) : (
                          <div className="setup-param-row">
                            <span
                              className="setup-param-label"
                              title="Double-click to rename"
                              onDoubleClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setEditingGrvParamIndex(idx)
                                setEditingGrvParamValue(name)
                              }}
                            >
                              {name}
                            </span>
                            <Link
                              to={
                                grvSlotForIndex(idx)
                                  ? editorPathForRockVolumeColumn(
                                      {
                                        kind: 'grv_slot',
                                        index: idx,
                                        slot: grvSlotForIndex(idx)!,
                                        label: name,
                                      },
                                      input,
                                    )
                                  : inputPathForGrv(idx, petroConstants, input)
                              }
                              className="setup-param-go"
                              onClick={(e) => e.stopPropagation()}
                              title="Edit distribution"
                            >
                              →
                            </Link>
                          </div>
                        )}
                      </li>
                    ))}
              </ul>
              {!useNrvDirectRockVolume && (
                <div className="setup-classic-actions">
                  <button type="button" className="btn-secondary" onClick={addGrvParam}>
                    +
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={removeSelectedGrvParam}
                    disabled={selectedGrvParamIndex == null || grvParamLabels.length <= 1}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="card setup-classic-card">
            <h3>Petrophysical Uncertainty</h3>
            <ul className="setup-classic-list-box">
              {activePetroKeys.length === 0 && (
                <li className="muted">All petrophysical parameters are constants.</li>
              )}
              {activePetroKeys.map((key) => (
                <li key={key}>
                  {editingParamKey === key ? (
                    <div className="setup-param-edit-row">
                      <input
                        autoFocus
                        type="text"
                        value={editingParamValue}
                        onChange={(e) => setEditingParamValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitParamEdit()
                          if (e.key === 'Escape') {
                            setEditingParamKey(null)
                            setEditingParamValue('')
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn-secondary setup-param-apply"
                        onClick={commitParamEdit}
                      >
                        Apply
                      </button>
                    </div>
                  ) : (
                    <div className="setup-param-row">
                      <span
                        className="setup-param-label"
                        title="Double-click to rename"
                        onDoubleClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          beginParamEdit(key)
                        }}
                      >
                        {setupPetroLabelForKey(key, petroParamLabels, petEvalLabel)}
                      </span>
                      <Link
                        to={editorPathForSetupPetroKey(key, input)}
                        className="setup-param-go"
                        title="Edit distribution"
                      >
                        →
                      </Link>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="card setup-classic-card">
            <h3>Segments</h3>
            <div className="setup-classic-dual">
              <ul className="setup-classic-list-box selectable">
                {segments.map((seg) => (
                  <li
                    key={seg.id}
                    className={seg.id === activeSegmentId ? 'active' : ''}
                    onClick={() => setActiveSegment(seg.id)}
                    onDoubleClick={() => {
                      setEditingSegmentId(seg.id)
                      setEditingSegmentValue(seg.name)
                    }}
                  >
                    {editingSegmentId === seg.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={editingSegmentValue}
                        onChange={(e) => setEditingSegmentValue(e.target.value)}
                        onBlur={() => {
                          renameSegment(seg.id, editingSegmentValue)
                          setEditingSegmentId(null)
                          setEditingSegmentValue('')
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            renameSegment(seg.id, editingSegmentValue)
                            setEditingSegmentId(null)
                            setEditingSegmentValue('')
                          }
                          if (e.key === 'Escape') setEditingSegmentId(null)
                        }}
                      />
                    ) : (
                      seg.name
                    )}
                  </li>
                ))}
              </ul>
              <div className="setup-classic-actions">
                <button type="button" className="btn-secondary" onClick={() => addSegment()}>
                  +
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!activeSegmentId || segments.length <= 1}
                  onClick={() => activeSegmentId && removeSegment(activeSegmentId)}
                >
                  ×
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!activeSegmentId}
                  onClick={() => activeSegmentId && moveSegment(activeSegmentId, 'up')}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!activeSegmentId}
                  onClick={() => activeSegmentId && moveSegment(activeSegmentId, 'down')}
                >
                  ↓
                </button>
              </div>
            </div>
          </div>
          <div className="card setup-classic-card">
            <h3>Reservoirs</h3>
            <div className="setup-classic-dual">
              <ul className="setup-classic-list-box selectable">
                {reservoirs.map((res) => (
                  <li
                    key={res.id}
                    className={res.id === activeReservoirId ? 'active' : ''}
                    onClick={() => setActiveReservoir(res.id)}
                    onDoubleClick={() => {
                      setEditingReservoirId(res.id)
                      setEditingReservoirValue(res.name)
                    }}
                  >
                    {editingReservoirId === res.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={editingReservoirValue}
                        onChange={(e) => setEditingReservoirValue(e.target.value)}
                        onBlur={() => {
                          renameReservoir(res.id, editingReservoirValue)
                          setEditingReservoirId(null)
                          setEditingReservoirValue('')
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            renameReservoir(res.id, editingReservoirValue)
                            setEditingReservoirId(null)
                            setEditingReservoirValue('')
                          }
                          if (e.key === 'Escape') setEditingReservoirId(null)
                        }}
                      />
                    ) : (
                      res.name
                    )}
                  </li>
                ))}
              </ul>
              <div className="setup-classic-actions">
                <button type="button" className="btn-secondary" onClick={addReservoir}>
                  +
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!activeReservoirId || reservoirs.length <= 1}
                  onClick={() => activeReservoirId && removeReservoir(activeReservoirId)}
                >
                  ×
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!activeReservoirId}
                  onClick={() => activeReservoirId && moveReservoir(activeReservoirId, 'up')}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!activeReservoirId}
                  onClick={() => activeReservoirId && moveReservoir(activeReservoirId, 'down')}
                >
                  ↓
                </button>
              </div>
            </div>
          </div>
        </div>
        )}

        {showMetadata && (
          <div className="card">
            <p className="convention-inline">
              Editing active tank:{' '}
              <strong>
                {(segments.find((s) => s.id === activeSegmentId)?.name ?? 'Segment')},{' '}
                {(reservoirs.find((r) => r.id === activeReservoirId)?.name ?? 'Reservoir')}
              </strong>
            </p>
            <div className="form-grid">
              <label>
                Prospect name
                <input
                  type="text"
                  value={input.prospect_name}
                  onChange={(e) => patch({ prospect_name: e.target.value })}
                />
              </label>
              <label>
                Zone name
                <input
                  type="text"
                  value={input.zone_name}
                  onChange={(e) => patch({ zone_name: e.target.value })}
                />
              </label>
              <label>
                Fluid type
                <select
                  value={input.fluid_type}
                  onChange={(e) => {
                    const fluid_type = e.target.value
                    const next = { ...input, fluid_type }
                    patch(
                      fluid_type === 'gas_condensate'
                        ? ensureGasCondensateFields(next)
                        : next,
                    )
                  }}
                >
                  <option value="oil">Oil</option>
                  <option value="gas">Gas</option>
                  <option value="gas_condensate">Gas condensate</option>
                </select>
              </label>
              <label>
                Country
                <input
                  type="text"
                  value={input.country ?? ''}
                  onChange={(e) => patch({ country: e.target.value })}
                />
              </label>
              <label>
                Basin
                <input
                  type="text"
                  value={input.basin ?? ''}
                  onChange={(e) => patch({ basin: e.target.value })}
                />
              </label>
              <label>
                Formation
                <input
                  type="text"
                  value={input.formation ?? ''}
                  onChange={(e) => patch({ formation: e.target.value })}
                />
              </label>
              <label>
                Iterations
                <NumericInput
                  allowEmpty={false}
                  value={input.n_iterations}
                  onChange={(v) => {
                    if (v != null && v >= 1000) patch({ n_iterations: Math.round(v) })
                  }}
                />
              </label>
              <label>
                Random seed
                <NumericInput
                  allowEmpty={false}
                  value={input.seed}
                  onChange={(v) => {
                    if (v != null) patch({ seed: Math.round(v) })
                  }}
                />
              </label>
              <label>
                Gas-oil ratio (mcf/bbl)
                <NumericInput
                  allowEmpty={false}
                  value={input.gas_oil_ratio}
                  onChange={(v) => {
                    if (v != null) patch({ gas_oil_ratio: v })
                  }}
                />
              </label>
              <label className="span-2">
                Notes
                <textarea
                  rows={3}
                  value={input.notes ?? ''}
                  onChange={(e) => patch({ notes: e.target.value })}
                />
              </label>
            </div>
          </div>
        )}

        {showMetadata && (
          <div className="card">
            <h2>Segments &amp; reservoirs</h2>
            <ReservoirSegmentManager />
          </div>
        )}

    </div>
  )
}
