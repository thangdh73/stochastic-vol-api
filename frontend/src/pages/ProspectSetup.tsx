import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EstimatingMethodHelpModal } from '../components/EstimatingMethodHelpModal'
import { NumericInput } from '../components/NumericInput'
import { WorkflowGate } from '../components/WorkflowGate'
import { ValidateBar } from '../components/ValidateBar'
import { ReservoirSegmentManager } from '../components/ReservoirSegmentManager'
import { UncertaintyGroupsPanel } from '../components/UncertaintyGroupsPanel'
import { useWorkflow } from '../context/WorkflowContext'
import type { EstimatingMethodHelpKey } from '../constants/estimatingMethodHelp'
import {
  ESTIMATING_METHOD_LABELS,
  effectiveEstimatingMethod,
} from '../utils/estimatingMethod'
import type {
  AreaInputUnit,
  EstimatingMethod,
  GasResourceUnit,
  OilResourceUnit,
  RockVolumeInputUnit,
} from '../types/api'
import { ensureGasCondensateFields, ensureNrvDistributions } from '../utils/defaultInput'
import {
  AREA_INPUT_UNITS,
  ROCK_VOLUME_INPUT_UNITS,
} from '../constants/inputUnits'
import {
  GAS_RESOURCE_UNITS,
  OIL_RESOURCE_UNITS,
  TOTAL_RESOURCE_UNITS,
} from '../constants/resourceUnits'

type SetupTab = 'estimating' | 'units' | 'groups' | 'metadata'

export function ProspectSetupPage() {
  const { input, segments, reservoirs, activeSegmentId, activeReservoirId, setInput } = useWorkflow()
  const [tab, setTab] = useState<SetupTab>('estimating')
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpKey, setHelpKey] = useState<EstimatingMethodHelpKey>('area_net_pay_yield')

  if (!input) {
    return (
      <div>
        <h1 className="page-title">Prospect Setup</h1>
        <WorkflowGate>{null}</WorkflowGate>
      </div>
    )
  }

  const patch = (partial: Partial<typeof input>) => setInput({ ...input, ...partial })
  const method = effectiveEstimatingMethod(input)

  const setMethod = (m: EstimatingMethod) => {
    const next = { ...input, estimating_method: m }
    patch(m === 'nrv_grv_yield' ? ensureNrvDistributions(next) : next)
  }

  const openHelp = (key: EstimatingMethodHelpKey) => {
    setHelpKey(key)
    setHelpOpen(true)
  }

  const nextPath = method === 'nrv_grv_yield' ? '/nrv' : '/area'
  const nextLabel = method === 'nrv_grv_yield' ? 'NRV / GRV' : 'Area'

  return (
    <div>
      <h1 className="page-title">Prospect Setup</h1>
      <p className="page-desc">
        Choose how net rock volume is built, then enter resource inputs on the workflow tabs.
      </p>
      <div className="card classic-toolbar">
        <div className="classic-toolbar-row">
          <strong>Setup workspace</strong>
          <span className="badge info">Reference-style setup tab</span>
          <Link to="/input">Next: Input</Link>
          <Link to="/dependency">Open Dependency</Link>
        </div>
      </div>

      <WorkflowGate>
        <ReservoirSegmentManager />

        <div className="sub-tabs">
          <button
            type="button"
            className={tab === 'estimating' ? 'sub-tab active' : 'sub-tab'}
            onClick={() => setTab('estimating')}
          >
            Estimating Method
          </button>
          <button
            type="button"
            className={tab === 'units' ? 'sub-tab active' : 'sub-tab'}
            onClick={() => setTab('units')}
          >
            Units
          </button>
          <button
            type="button"
            className={tab === 'groups' ? 'sub-tab active' : 'sub-tab'}
            onClick={() => setTab('groups')}
          >
            Dependency groups
          </button>
          <button
            type="button"
            className={tab === 'metadata' ? 'sub-tab active' : 'sub-tab'}
            onClick={() => setTab('metadata')}
          >
            Prospect &amp; Settings
          </button>
        </div>

        {tab === 'estimating' && (
          <div className="card">
            <h2>How should resources be estimated?</h2>
            <p className="convention-inline">
              Active method: <strong>{ESTIMATING_METHOD_LABELS[method]}</strong>
            </p>

            <label className="radio-row block-radio">
              <input
                type="radio"
                name="estimating-method"
                checked={method === 'area_net_pay_yield'}
                onChange={() => setMethod('area_net_pay_yield')}
              />
              <span>
                <strong>Volumetric: Area × Net Pay × HC Yield</strong>
                <br />
                <span className="muted">
                  Multiply Area × Net Pay × HC Yield distributions. Most commonly used
                  estimating method.
                </span>
              </span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => openHelp('area_net_pay_yield')}
              >
                Diagram / Explain
              </button>
            </label>

            <label className="radio-row block-radio">
              <input
                type="radio"
                name="estimating-method"
                checked={method === 'nrv_grv_yield'}
                onChange={() => setMethod('nrv_grv_yield')}
              />
              <span>
                <strong>Volumetric: Net Rock Volume × HC Yield</strong>
                <br />
                <span className="muted">
                  Multiply Net Rock Volume × HC Yield distributions. Often used when NRV
                  (or GRV) is available from a workstation interpretation.
                </span>
              </span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => openHelp('nrv_grv_yield')}
              >
                Diagram / Explain
              </button>
            </label>
          </div>
        )}

        {tab === 'units' && (
          <>
          <div className="card">
            <h2>Input units (Area, GRV, NRV)</h2>
            <p className="convention-inline">
              Controls how you enter and view distributions on the Area and NRV / GRV tabs.
              The engine always stores <strong>acres</strong> for area and <strong>acre-ft</strong>{' '}
              for rock volume internally.
            </p>
            <div className="form-grid">
              <label>
                Closed / productive area
                <select
                  value={input.area_input_unit ?? 'acres'}
                  onChange={(e) =>
                    patch({ area_input_unit: e.target.value as AreaInputUnit })
                  }
                >
                  {AREA_INPUT_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Gross rock volume (GRV)
                <select
                  value={input.grv_input_unit ?? 'acre_ft'}
                  onChange={(e) =>
                    patch({ grv_input_unit: e.target.value as RockVolumeInputUnit })
                  }
                >
                  {ROCK_VOLUME_INPUT_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Net rock volume (NRV direct)
                <select
                  value={input.nrv_input_unit ?? 'acre_ft'}
                  onChange={(e) =>
                    patch({ nrv_input_unit: e.target.value as RockVolumeInputUnit })
                  }
                >
                  {ROCK_VOLUME_INPUT_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="card">
            <h2>Resource units (results labels)</h2>
            <p className="convention-inline">
              Labels used on Results, export, and Pg-risked totals. Calculations remain in
              canonical units (MMbbl / Bcf / MMBOE internally).
            </p>
            <div className="form-grid">
              <label>
                Oil / liquids
                <select
                  value={input.oil_resource_unit ?? 'MMBO'}
                  onChange={(e) =>
                    patch({ oil_resource_unit: e.target.value as OilResourceUnit })
                  }
                >
                  {OIL_RESOURCE_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Gas
                <select
                  value={input.gas_resource_unit ?? 'BCF'}
                  onChange={(e) =>
                    patch({ gas_resource_unit: e.target.value as GasResourceUnit })
                  }
                >
                  {GAS_RESOURCE_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Total (BOE)
                <select
                  value={input.total_resource_unit ?? 'MMBOE'}
                  onChange={() => patch({ total_resource_unit: 'MMBOE' })}
                  disabled
                >
                  {TOTAL_RESOURCE_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Gas-oil ratio for MMBOE (mcf/bbl)
                <NumericInput
                  allowEmpty={false}
                  value={input.gas_oil_ratio}
                  onChange={(v) => {
                    if (v != null) patch({ gas_oil_ratio: v })
                  }}
                />
              </label>
            </div>
          </div>
          </>
        )}

        {tab === 'groups' && <UncertaintyGroupsPanel />}

        {tab === 'metadata' && (
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

        <EstimatingMethodHelpModal
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          selectedKey={helpKey}
          onSelectKey={setHelpKey}
        />

        <ValidateBar />

        <div className="btn-row">
          <Link to={nextPath}>
            <button type="button" className="primary">
              Next: {nextLabel} →
            </button>
          </Link>
          <Link to="/simulation">
            <button type="button">Simulation</button>
          </Link>
        </div>
      </WorkflowGate>
    </div>
  )
}
