import { Link, Navigate, useLocation } from 'react-router-dom'
import { useWorkflow } from '../context/WorkflowContext'
import {
  ESTIMATING_METHOD_SHORT,
  effectiveEstimatingMethod,
} from '../utils/estimatingMethod'

const AREA_ONLY_PATHS = ['/area', '/net-pay']
const NRV_ONLY_PATH = '/nrv'

export function EstimatingMethodRouteGuard() {
  const { input } = useWorkflow()
  const { pathname } = useLocation()

  if (!input) return null

  const method = effectiveEstimatingMethod(input)
  const onAreaPath = AREA_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  const onNrvPath = pathname === NRV_ONLY_PATH || pathname.startsWith(`${NRV_ONLY_PATH}/`)

  if (method === 'nrv_grv_yield' && onAreaPath) {
    return <Navigate to="/nrv" replace />
  }

  if (method === 'area_net_pay_yield' && onNrvPath) {
    return <Navigate to="/area" replace />
  }

  return null
}

export function EstimatingMethodBanner() {
  const { input } = useWorkflow()
  if (!input) return null

  const method = effectiveEstimatingMethod(input)

  const volumetric =
    method === 'nrv_grv_yield'
      ? 'NRV / GRV → HC Yield → Chance → Simulation'
      : 'Area → Net Pay → HC Yield → Chance → Simulation'

  return (
    <div className="workflow-method-banner" role="status">
      <span className="workflow-method-label">
        Estimating method: <strong>{ESTIMATING_METHOD_SHORT[method]}</strong>
      </span>
      <span className="workflow-method-steps">Workflow: {volumetric}</span>
      <Link to="/prospect" className="workflow-method-change">
        Change method
      </Link>
    </div>
  )
}
