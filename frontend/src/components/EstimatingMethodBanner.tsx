import { Navigate, useLocation } from 'react-router-dom'
import { useWorkflow } from '../context/WorkflowContext'

const LEGACY_AREA_PATHS = ['/input/area', '/input/net-pay', '/area', '/net-pay']

export function EstimatingMethodRouteGuard() {
  const { pathname } = useLocation()
  const onLegacyAreaPath = LEGACY_AREA_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )

  if (onLegacyAreaPath) {
    return <Navigate to="/input/rock-volume" replace />
  }

  return null
}

export function EstimatingMethodBanner() {
  const { input } = useWorkflow()
  if (!input) return null

  return (
    <div className="workflow-method-banner" role="status">
      <span className="workflow-method-label">
        Rock volume: <strong>GRV / NRV × HC Yield</strong>
      </span>
      <span className="workflow-method-steps">
        Workflow: NRV / GRV → HC Yield → Chance → Simulation
      </span>
    </div>
  )
}
