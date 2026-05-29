import { useMemo } from 'react'
import { useWorkflow } from '../context/WorkflowContext'
import { buildTankRows } from '../utils/tankLabels'
import { getNtgLinkedTankKeys } from '../utils/tankNrvShared'

/** Linked NTG (Option B): auto-sync NTG within reservoir and/or segment groups. */
export function NtgSharingPanel() {
  const {
    reservoirs,
    segments,
    activeReservoirId,
    activeSegmentId,
  } = useWorkflow()

  const activeReservoir = reservoirs.find((r) => r.id === activeReservoirId)
  const activeSegment = segments.find((s) => s.id === activeSegmentId)

  const linkedCodes = useMemo(() => {
    if (!activeSegmentId || !activeReservoirId) return []
    const keys = getNtgLinkedTankKeys(
      activeSegmentId,
      activeReservoirId,
      segments,
      reservoirs,
    )
    const rows = buildTankRows(reservoirs, segments, () => undefined)
    return rows.filter((r) => keys.includes(r.tankId)).map((r) => r.tankCode)
  }, [activeSegmentId, activeReservoirId, segments, reservoirs])

  const resLinked = Boolean(activeReservoir?.shared_ntg)
  const segLinked = Boolean(activeSegment?.shared_ntg)

  return (
    <div className="ntg-sharing-panel">
      <p className="convention-inline" style={{ margin: '0 0 0.5rem' }}>
        <strong>Linked NTG (recommended):</strong> GRV stays different per tank. NTG is shared
        within groups you turn on in Prospect Setup.
      </p>
      <ul className="convention-inline" style={{ margin: '0 0 0.5rem', paddingLeft: '1.2rem' }}>
        <li>
          <strong>NTG↔Seg</strong> on a <em>reservoir</em> — all segments in that reservoir share NTG
          (e.g. <strong>R1-S1</strong> and <strong>R1-S2</strong> stay linked;{' '}
          <strong>R2-S1</strong> and <strong>R2-S2</strong> are a separate group).
        </li>
        <li>
          <strong>NTG↔Res</strong> on a <em>segment</em> (optional) — all reservoirs in that
          segment share NTG (e.g. R1-S1 and R2-S1).
        </li>
      </ul>
      {(resLinked || segLinked) && (
        <p className="alert info" style={{ marginBottom: 0 }}>
          Active tank is linked with: <strong>{linkedCodes.join(', ')}</strong>.{' '}
          Edit NTG in the <strong>NTG</strong> table above — linked tanks update
          automatically. GRV is not linked.
        </p>
      )}
      {!resLinked && !segLinked && activeReservoir && (
        <p className="alert warn" style={{ marginBottom: 0 }}>
          No NTG link on this tank. Enable <strong>NTG↔Seg</strong> on{' '}
          <strong>{activeReservoir.name}</strong> in Prospect Setup to link R1-S1 / R1-S2 style
          groups.
        </p>
      )}
    </div>
  )
}
