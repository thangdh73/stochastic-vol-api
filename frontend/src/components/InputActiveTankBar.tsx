import { TankSelectorStrip } from './TankSelectorStrip'
import { useWorkflow } from '../context/WorkflowContext'
import { tankCode } from '../utils/tankLabels'

/** Active-tank label + quick tank chips (used below the all-tanks table on Rock volume). */
export function InputActiveTankBar() {
  const { reservoirs, segments, activeReservoirId, activeSegmentId } = useWorkflow()
  const reservoirIndex = reservoirs.findIndex((r) => r.id === activeReservoirId)
  const segmentIndex = segments.findIndex((s) => s.id === activeSegmentId)
  const reservoir = reservoirIndex >= 0 ? reservoirs[reservoirIndex] : null
  const segment = segmentIndex >= 0 ? segments[segmentIndex] : null
  const activeLabel =
    reservoir && segment
      ? `${tankCode(reservoirIndex, segmentIndex)} — ${segment.name}, ${reservoir.name}`
      : null

  return (
    <div className="input-toolbar card input-active-tank-bar">
      <h2 className="input-active-tank-heading">Active tank</h2>
      {activeLabel ? (
        <span className="input-toolbar-active">
          Editing: <strong>{activeLabel}</strong>
        </span>
      ) : (
        <span className="input-toolbar-active muted">Select a tank in the table above</span>
      )}
      <TankSelectorStrip />
    </div>
  )
}
