import { useWorkflow } from '../context/WorkflowContext'
import { tankCode } from '../utils/tankLabels'

export function InputScopeBadge() {
  const { reservoirs, segments, activeReservoirId, activeSegmentId } = useWorkflow()
  const reservoirIndex = reservoirs.findIndex((r) => r.id === activeReservoirId)
  const segmentIndex = segments.findIndex((s) => s.id === activeSegmentId)
  const reservoir = reservoirIndex >= 0 ? reservoirs[reservoirIndex] : null
  const segment = segmentIndex >= 0 ? segments[segmentIndex] : null

  if (!reservoir || !segment) return null

  const code = tankCode(reservoirIndex, segmentIndex)

  return (
    <div className="alert info nrv-scope-sticky">
      Editing tank <strong>{code}</strong> — {segment.name}, {reservoir.name}
    </div>
  )
}
