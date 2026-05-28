import { useMemo } from 'react'
import { useWorkflow } from '../context/WorkflowContext'
import { buildTankRows } from '../utils/tankLabels'

/** Quick tank switcher — one button per Segment × Reservoir tank. */
export function TankSelectorStrip() {
  const {
    reservoirs,
    segments,
    activeReservoirId,
    activeSegmentId,
    setActiveReservoir,
    setActiveSegment,
    getTankInput,
  } = useWorkflow()

  const rows = useMemo(
    () =>
      buildTankRows(reservoirs, segments, (segmentId, reservoirId) =>
        getTankInput(segmentId, reservoirId)?.estimating_method,
      ),
    [reservoirs, segments, getTankInput],
  )

  if (rows.length <= 1) return null

  const select = (reservoirId: string, segmentId: string) => {
    setActiveReservoir(reservoirId)
    setActiveSegment(segmentId)
  }

  return (
    <div className="tank-selector-strip">
      <span className="tank-selector-label">Tanks:</span>
      <div className="tank-selector-buttons">
        {rows.map((row) => {
          const active =
            row.segmentId === activeSegmentId && row.reservoirId === activeReservoirId
          return (
            <button
              key={row.tankId}
              type="button"
              className={active ? 'tank-chip active' : 'tank-chip'}
              onClick={() => select(row.reservoirId, row.segmentId)}
              title={row.uniqueId}
            >
              {row.tankCode}
            </button>
          )
        })}
      </div>
    </div>
  )
}
