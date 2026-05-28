import { useMemo } from 'react'
import { useWorkflow } from '../context/WorkflowContext'
import { buildTankRows } from '../utils/tankLabels'
import { getHcYieldLinkedTankKeys } from '../utils/tankHcYieldShared'

/** Linked HC yield: auto-sync porosity, saturation, recovery, and fluid props within groups. */
export function HcYieldSharingPanel() {
  const { reservoirs, segments, activeReservoirId, activeSegmentId } = useWorkflow()

  const activeReservoir = reservoirs.find((r) => r.id === activeReservoirId)
  const activeSegment = segments.find((s) => s.id === activeSegmentId)

  const linkedCodes = useMemo(() => {
    if (!activeSegmentId || !activeReservoirId) return []
    const keys = getHcYieldLinkedTankKeys(
      activeSegmentId,
      activeReservoirId,
      segments,
      reservoirs,
    )
    const rows = buildTankRows(reservoirs, segments, () => undefined)
    return rows.filter((r) => keys.includes(r.tankId)).map((r) => r.tankCode)
  }, [activeSegmentId, activeReservoirId, segments, reservoirs])

  const resLinked = Boolean(activeReservoir?.shared_hc_yield)
  const segLinked = Boolean(activeSegment?.shared_hc_yield)

  return (
    <div className="ntg-sharing-panel">
      <p className="convention-inline" style={{ margin: '0 0 0.5rem' }}>
        <strong>Linked HC yield (recommended):</strong> NRV / GRV can differ per tank. Porosity,
        saturation, recovery, FVF/GEF, GOR, and related toggles are shared within groups you turn on
        in Prospect Setup.
      </p>
      <ul className="convention-inline" style={{ margin: '0 0 0.5rem', paddingLeft: '1.2rem' }}>
        <li>
          <strong>HC↔Seg</strong> on a <em>reservoir</em> — all segments in that reservoir share HC
          yield (e.g. <strong>R1-S1</strong> and <strong>R1-S2</strong>).
        </li>
        <li>
          <strong>HC↔Res</strong> on a <em>segment</em> (optional) — all reservoirs in that segment
          share HC yield (e.g. R1-S1 and R2-S1).
        </li>
      </ul>
      {(resLinked || segLinked) && (
        <p className="alert info" style={{ marginBottom: 0 }}>
          Active tank is linked with: <strong>{linkedCodes.join(', ')}</strong>. Edit HC yield below
          — linked tanks update automatically.
        </p>
      )}
      {!resLinked && !segLinked && activeReservoir && (
        <p className="alert warn" style={{ marginBottom: 0 }}>
          No HC yield link on this tank. Enable <strong>HC↔Seg</strong> on{' '}
          <strong>{activeReservoir.name}</strong> in Prospect Setup to link R1-S1 / R1-S2 style
          groups.
        </p>
      )}
    </div>
  )
}
