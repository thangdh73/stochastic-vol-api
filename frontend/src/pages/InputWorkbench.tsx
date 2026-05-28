import { Link } from 'react-router-dom'
import { InputScopeBadge } from '../components/InputScopeBadge'
import { TankSelectorStrip } from '../components/TankSelectorStrip'
import { ValidateBar } from '../components/ValidateBar'
import { WorkflowGate } from '../components/WorkflowGate'
import { useWorkflow } from '../context/WorkflowContext'
import { effectiveEstimatingMethod } from '../utils/estimatingMethod'

export function InputWorkbenchPage() {
  const { input } = useWorkflow()
  const method = input ? effectiveEstimatingMethod(input) : 'area_net_pay_yield'

  return (
    <div>
      <h1 className="page-title">Input</h1>
      <p className="page-desc">
        Reference-style input workspace. Use the selector below to work per segment and reservoir.
      </p>

      <WorkflowGate>
        <div className="card classic-toolbar">
          <div className="classic-toolbar-row">
            <strong>Input mode</strong>
            <span className="badge info">
              {method === 'nrv_grv_yield' ? 'NRV x HC Yield' : 'Area x Net Pay x HC Yield'}
            </span>
            <Link to={method === 'nrv_grv_yield' ? '/nrv' : '/area'}>Open primary editor</Link>
          </div>
        </div>

        <InputScopeBadge />
        <TankSelectorStrip />

        <div className="classic-grid-2">
          <div className="card">
            <h2>GRV / geometric uncertainties</h2>
            <p className="convention-inline">Depth, pinchout, OWC, area, net pay, GRV and related inputs.</p>
            <div className="btn-row">
              <Link to="/area">Area editor</Link>
              <Link to="/net-pay">Net Pay editor</Link>
              <Link to="/nrv">NRV / GRV editor</Link>
            </div>
          </div>

          <div className="card">
            <h2>Petrophysical and fluid uncertainties</h2>
            <p className="convention-inline">Porosity, Sw, Bo/GEF/FVF, recovery, GOR, and chance controls.</p>
            <div className="btn-row">
              <Link to="/hc-yield">HC Yield editor</Link>
              <Link to="/chance">Chance editor</Link>
            </div>
          </div>
        </div>

        <ValidateBar />
      </WorkflowGate>
    </div>
  )
}
