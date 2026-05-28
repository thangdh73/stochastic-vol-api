import { Link } from 'react-router-dom'

import { ChanceModuleSummary } from '../components/ChanceModuleSummary'

import { CcopChanceForm } from '../components/CcopChanceForm'

import { ModuleSimulationButton } from '../components/ModuleSimulationButton'
import { InputScopeBadge } from '../components/InputScopeBadge'
import { TankSelectorStrip } from '../components/TankSelectorStrip'

import { ValidateBar } from '../components/ValidateBar'

import { WorkflowGate } from '../components/WorkflowGate'

import { useWorkflow } from '../context/WorkflowContext'

import { NumericInput } from '../components/NumericInput'

import { defaultCcopRisk } from '../constants/ccopChance'

import { includeChance, setIncludeChance } from '../utils/calculationToggles'

import type { RiskModel } from '../types/api'



const CATEGORY_LABELS: Record<string, string> = {

  source: 'Source',

  timing_migration: 'Timing / Migration',

  reservoir: 'Reservoir',

  closure: 'Closure',

  containment: 'Containment',

}



const DEFAULT_CATEGORIES = [

  'source',

  'timing_migration',

  'reservoir',

  'closure',

  'containment',

]



const DEFAULT_LEGACY_CHANCE: Record<string, number[]> = {

  source: [0.7],

  timing_migration: [0.7],

  reservoir: [0.7],

  closure: [0.7],

  containment: [0.7],

}



export function ChancePage() {

  const { input, setInput, getModulePreview, error } = useWorkflow()

  const chancePreview = getModulePreview('chance')

  const chanceOn = input ? includeChance(input) : true

  const riskModel: RiskModel = input?.risk_model ?? 'ccop_v1'

  const useCcop = riskModel === 'ccop_v1'



  const updateCategory = (cat: string, values: number[]) => {

    if (!input) return

    setInput({

      ...input,

      chance_categories: { ...input.chance_categories, [cat]: values },

    })

  }



  const updateSubFactor = (cat: string, index: number, v: number | null) => {

    if (!input || v == null) return

    const factors = [...(input.chance_categories[cat] ?? [0.7])]

    factors[index] = Math.min(1, Math.max(0, v))

    updateCategory(cat, factors)

  }



  const addSubFactor = (cat: string) => {

    if (!input) return

    const factors = [...(input.chance_categories[cat] ?? [])]

    factors.push(0.7)

    updateCategory(cat, factors)

  }



  const setRiskModel = (model: RiskModel) => {

    if (!input) return

    if (model === 'ccop_v1') {

      setInput({

        ...input,

        risk_model: model,

        chance_categories: {},

        ccop_risk: input.ccop_risk ?? defaultCcopRisk(),

        include_chance: true,

      })

    } else {

      setInput({

        ...input,

        risk_model: model,

        ccop_risk: null,

        chance_categories:

          Object.keys(input.chance_categories ?? {}).length > 0

            ? input.chance_categories

            : DEFAULT_LEGACY_CHANCE,

        include_chance: true,

      })

    }

  }



  return (

    <div>

      <h1 className="page-title">Chance</h1>

      <p className="page-desc">

        Geologic chance of success (Pg). Use <strong>CCOP (2000)</strong> for four-factor risking

        with descriptor tables, or <strong>Legacy</strong> for five weak-link categories. Only the

        selected model is sent to the engine.

      </p>



      {error && <div className="alert error">{error}</div>}



      <WorkflowGate>
        <InputScopeBadge />
        <TankSelectorStrip />

        {input && (

          <>

            <div className="card toggle-card">

              <h2>Calculation options</h2>

              <label className="toggle-row">

                <input

                  type="checkbox"

                  checked={chanceOn}

                  onChange={(e) => setInput(setIncludeChance(input, e.target.checked))}

                />

                Include chance (Pg)

              </label>

              <label style={{ display: 'block', marginTop: '0.75rem' }}>

                Risk model

                <select

                  value={riskModel}

                  onChange={(e) => setRiskModel(e.target.value as RiskModel)}

                >

                  <option value="ccop_v1">CCOP (2000) — reservoir, trap, charge, retention</option>

                  <option value="legacy">Legacy — 5 categories (weak-link)</option>

                </select>

              </label>

            </div>



            {!chanceOn ? (

              <div className="card">

                <p className="alert info">

                  Chance evaluation is skipped. Pg and Pg-risked mean will be reported as

                  not available (NA) in results.

                </p>

              </div>

            ) : useCcop ? (

              <>

                <CcopChanceForm

                  value={input.ccop_risk ?? defaultCcopRisk()}

                  onChange={(ccop_risk) =>

                    setInput({ ...input, risk_model: 'ccop_v1', ccop_risk, chance_categories: {} })

                  }

                />

                <div className="card">

                  <div className="card-header-row">

                    <h2>Pg &amp; risk review</h2>

                    <ModuleSimulationButton scope="chance" className="primary" />

                  </div>

                  {chancePreview ? (
                    <ChanceModuleSummary
                      preview={chancePreview}
                      variant="ccop"
                      ccopRisk={input.ccop_risk ?? defaultCcopRisk()}
                    />
                  ) : (
                    <p className="alert info">
                      Click <strong>Run Chance simulation</strong> to compute Pg and build the
                      risk review table.
                    </p>
                  )}

                </div>

              </>

            ) : (

              <>

                {DEFAULT_CATEGORIES.map((cat) => {

                  const factors = input.chance_categories[cat] ?? [0.7]

                  return (

                    <div className="card" key={cat}>

                      <h2>{CATEGORY_LABELS[cat] ?? cat}</h2>

                      <p className="convention-inline">

                        Category chance = min(sub-factors)

                      </p>

                      {factors.map((f, idx) => (

                        <label key={idx} className="chance-row">

                          Sub-factor {idx + 1}

                          <NumericInput

                            value={f}

                            allowEmpty={false}

                            onChange={(v) => updateSubFactor(cat, idx, v)}

                          />

                          <span className="pct-hint">({(f * 100).toFixed(1)}%)</span>

                        </label>

                      ))}

                      <button type="button" onClick={() => addSubFactor(cat)}>

                        + Add sub-factor

                      </button>

                    </div>

                  )

                })}



                <div className="card">

                  <div className="card-header-row">

                    <h2>Pg preview</h2>

                    <ModuleSimulationButton scope="chance" className="primary" />

                  </div>

                  {chancePreview ? (

                    <ChanceModuleSummary preview={chancePreview} variant="legacy" />

                  ) : (

                    <p className="alert info">

                      Click <strong>Run Chance simulation</strong> to compute Pg from the

                      categories above.

                    </p>

                  )}

                </div>

              </>

            )}



            <ValidateBar />



            <div className="btn-row">

              <Link to="/hc-yield">

                <button type="button">← HC Yield</button>

              </Link>

              <Link to="/correlations">

                <button type="button" className="primary">

                  Next: Correlations →

                </button>

              </Link>

            </div>

          </>

        )}

      </WorkflowGate>

    </div>

  )

}

