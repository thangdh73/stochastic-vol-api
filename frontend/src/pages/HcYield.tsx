import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { DistributionInputCard } from '../components/DistributionInputCard'
import { HcYieldSharingPanel } from '../components/HcYieldSharingPanel'
import { InputScopeBadge } from '../components/InputScopeBadge'
import { TankSelectorStrip } from '../components/TankSelectorStrip'
import { pickSharedHcYieldFields } from '../utils/tankHcYieldShared'

import { ModuleQcSection } from '../components/ModuleQcSection'

import { ValidateBar } from '../components/ValidateBar'

import { WorkflowGate } from '../components/WorkflowGate'

import { useWorkflow } from '../context/WorkflowContext'

import {

  applyOilRecovery,

  includeSolutionGas,

  setApplyOilRecovery,

  setIncludeSolutionGas,

} from '../utils/calculationToggles'

import { volumetricStepBeforeHcYield } from '../utils/estimatingMethod'

import { updateDistribution, type DistKey } from '../utils/inputHelpers'



function OilYieldFields({

  input,

  setInput,

}: {

  input: NonNullable<ReturnType<typeof useWorkflow>['input']>

  setInput: (v: typeof input) => void

}) {

  const sgOn = includeSolutionGas(input)

  const recoveryOn = applyOilRecovery(input)



  const fields: { key: DistKey; asPercent?: boolean; show: boolean }[] = [

    { key: 'porosity_dist', asPercent: true, show: true },

    { key: 'saturation_dist', asPercent: true, show: true },

    { key: 'oil_recovery_dist', asPercent: true, show: recoveryOn },

    { key: 'fvf_dist', show: true },

    { key: 'gor_dist', show: sgOn },

    { key: 'solution_gas_recovery_dist', asPercent: true, show: sgOn },

  ]



  return (

    <>

      <div className="card toggle-card">

        <h2>Calculation options (oil)</h2>

        <label className="toggle-row">

          <input

            type="checkbox"

            checked={sgOn}

            onChange={(e) => setInput(setIncludeSolutionGas(input, e.target.checked))}

          />

          Include solution gas (GOR)

        </label>

        <label className="toggle-row">

          <input

            type="checkbox"

            checked={recoveryOn}

            onChange={(e) => setInput(setApplyOilRecovery(input, e.target.checked))}

          />

          Apply oil recovery factor

        </label>

        {!recoveryOn && (

          <p className="alert warn">

            Recovery is off: recoverable oil will equal STOIIP (in-place proxy). Do not

            interpret as PRMS recoverable resources or reserves.

          </p>

        )}

      </div>



      {fields

        .filter((f) => f.show)

        .map(({ key, asPercent }) => {

          const dist = input[key]

          if (!dist) return null

          return (

            <div className="card" key={key}>

              <DistributionInputCard

                dist={dist}

                onChange={(d) => setInput(updateDistribution(input, key, d))}

                asPercent={asPercent}

              />

            </div>

          )

        })}

    </>

  )

}



function GasYieldFields({

  input,

  setInput,

}: {

  input: NonNullable<ReturnType<typeof useWorkflow>['input']>

  setInput: (v: typeof input) => void

}) {

  const fields: { key: DistKey; asPercent?: boolean }[] = [

    { key: 'porosity_dist', asPercent: true },

    { key: 'saturation_dist', asPercent: true },

    { key: 'gas_recovery_dist', asPercent: true },

    { key: 'gef_dist' },

  ]

  if (input.fluid_type === 'gas_condensate') {

    fields.push({ key: 'condensate_yield_dist' })

  }



  return (

    <>

      {fields.map(({ key, asPercent }) => {

        const dist = input[key]

        if (!dist) return null

        return (

          <div className="card" key={key}>

            <DistributionInputCard

              dist={dist}

              onChange={(d) => setInput(updateDistribution(input, key, d))}

              asPercent={asPercent}

            />

          </div>

        )

      })}

    </>

  )

}



export function HcYieldPage() {
  const { input, setInput, setModulePreview, error } = useWorkflow()
  const isGas = input?.fluid_type === 'gas' || input?.fluid_type === 'gas_condensate'
  const prevVolumetric = input ? volumetricStepBeforeHcYield(input) : null

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

  // Fix stale state: recovery off but flag still true from older saves / API defaults
  useEffect(() => {
    if (!input || isGas) return
    if (!applyOilRecovery(input) && input.apply_oil_recovery !== false) {
      setInput(setApplyOilRecovery(input, false))
    }
  }, [input, isGas, setInput])

  return (

    <div>

      <h1 className="page-title">HC Yield</h1>

      <p className="page-desc">

        Porosity, saturation, recovery, and fluid properties (

        {input?.fluid_type ?? '—'} case). Each tank can have its own HC yield, or link groups in

        Prospect Setup (like NTG). Fractions entered as % where noted.

      </p>

      {input?.fluid_type === 'gas_condensate' && (
        <div className="alert info" role="note">
          <strong>Condensate</strong> (MMbbl) = Recoverable gas (Bcf) × Condensate yield (bbl/MMscf) ÷ 1000.
          Typical yields are roughly 20–100 bbl/MMscf. A yield of 0 gives no condensate. If you use{' '}
          <strong>MMscm</strong> for liquids on Prospect Setup → Units, condensate is shown in MMscm (smaller
          numbers than MMbbl for the same volume).
        </div>
      )}



      {error && <div className="alert error">{error}</div>}



      <WorkflowGate>
        <InputScopeBadge />
        <TankSelectorStrip />
        <HcYieldSharingPanel />

        {input && (

          <>

            {isGas ? (

              <GasYieldFields input={input} setInput={handleInputChange} />

            ) : (

              <OilYieldFields input={input} setInput={handleInputChange} />

            )}



            <ModuleQcSection

              scope="hc_yield"

              title="HC Yield — QC histograms"

            />



            <ValidateBar />



            <div className="btn-row">

              {prevVolumetric && (

                <Link to={prevVolumetric.to}>

                  <button type="button">← {prevVolumetric.label}</button>

                </Link>

              )}

              <Link to="/chance">

                <button type="button" className="primary">

                  Next: Chance →

                </button>

              </Link>

            </div>

          </>

        )}

      </WorkflowGate>

    </div>

  )

}

