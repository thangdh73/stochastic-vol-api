import { Link } from 'react-router-dom'
import { NetPayDistributionForm } from '../components/NetPayDistributionForm'
import { ModuleQcSection } from '../components/ModuleQcSection'
import { InputScopeBadge } from '../components/InputScopeBadge'
import { TankSelectorStrip } from '../components/TankSelectorStrip'
import { ValidateBar } from '../components/ValidateBar'
import { WorkflowGate } from '../components/WorkflowGate'
import { useWorkflow } from '../context/WorkflowContext'
import { updateDistribution } from '../utils/inputHelpers'
import { useState } from 'react'
import type { NetPayDisplayUnit } from '../utils/netPayUnits'
import { DistributionInputCard } from '../components/DistributionInputCard'

export function NetPayPage() {
  const { input, setInput, error } = useWorkflow()
  const [displayUnit, setDisplayUnit] = useState<NetPayDisplayUnit>('feet')

  return (
    <div>
      <h1 className="page-title">Net Pay</h1>
      <p className="page-desc">
        Net pay thickness (canonical unit: feet). You can enter in feet or metres;
        values are stored in feet internally for calculation reproducibility.
      </p>

      {error && <div className="alert error">{error}</div>}

      <WorkflowGate>
        <InputScopeBadge />
        <TankSelectorStrip />
        {input?.net_pay_dist && (
          <>
            <div className="card">
              <h2>Thickness unit</h2>
              <div className="btn-row" style={{ marginBottom: 0 }}>
                <label className="radio-row">
                  <input
                    type="radio"
                    name="netpay-unit"
                    checked={displayUnit === 'feet'}
                    onChange={() => {
                      ;(document.activeElement as HTMLElement | null)?.blur?.()
                      setDisplayUnit('feet')
                    }}
                  />
                  Feet
                </label>
                <label className="radio-row">
                  <input
                    type="radio"
                    name="netpay-unit"
                    checked={displayUnit === 'metres'}
                    onChange={() => {
                      ;(document.activeElement as HTMLElement | null)?.blur?.()
                      setDisplayUnit('metres')
                    }}
                  />
                  Metres
                </label>
              </div>
              <p className="convention-inline">
                The engine always stores <strong>feet</strong> internally. This selector
                controls display and input only.
              </p>
            </div>

            <div className="card">
              <NetPayDistributionForm
                canonicalDist={input.net_pay_dist}
                displayUnit={displayUnit}
                onCommit={(canonical) => setInput(updateDistribution(input, 'net_pay_dist', canonical))}
              />
            </div>

            {input.geometric_correction_dist && (
              <div className="card">
                <h2>Geometric correction factor (GCF)</h2>
                <p className="convention-inline">
                  Multiplier applied to the net rock volume calculation (default 100%).
                  This is the same GCF used on the Area tab.
                </p>
                <DistributionInputCard
                  dist={input.geometric_correction_dist}
                  onChange={(d) =>
                    setInput(updateDistribution(input, 'geometric_correction_dist', d))
                  }
                  asPercent
                />
              </div>
            )}

            <ModuleQcSection
              scope="net_pay"
              title="Net Pay — QC histogram"
            />

            <ValidateBar />

            <div className="btn-row">
              <Link to="/area">
                <button type="button">← Area</button>
              </Link>
              <Link to="/hc-yield">
                <button type="button" className="primary">
                  Next: HC Yield →
                </button>
              </Link>
            </div>
          </>
        )}
      </WorkflowGate>
    </div>
  )
}
