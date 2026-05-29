import { Navigate } from 'react-router-dom'

/** Legacy full-page route; prefer Input → HC yield tab. */
export function HcYieldPage() {
  return <Navigate to="/input/hc-yield" replace />
}
