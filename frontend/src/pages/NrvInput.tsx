import { Navigate } from 'react-router-dom'

/** Legacy route — rock volume editor lives on Input → Rock volume. */
export function NrvInputPage() {
  return <Navigate to="/input/rock-volume#active-tank-editor" replace />
}
