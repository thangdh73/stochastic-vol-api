import { useMemo } from 'react'
import { useWorkflow } from '../context/WorkflowContext'
import { buildTankRows } from '../utils/tankLabels'
import { getCorrelationLinkedTankKeys } from '../utils/tankCorrelationShared'

/** Linked correlations: same ρ matrix / pairs within reservoir or segment groups. */
export function CorrelationSharingPanel() {
  const { reservoirs, segments, activeReservoirId, activeSegmentId } = useWorkflow()

  const activeReservoir = reservoirs.find((r) => r.id === activeReservoirId)
  const activeSegment = segments.find((s) => s.id === activeSegmentId)

  const linkedCodes = useMemo(() => {
    if (!activeSegmentId || !activeReservoirId) return []
    const keys = getCorrelationLinkedTankKeys(
      activeSegmentId,
      activeReservoirId,
      segments,
      reservoirs,
    )
    const rows = buildTankRows(reservoirs, segments, () => undefined)
    return rows.filter((r) => keys.includes(r.tankId)).map((r) => r.tankCode)
  }, [activeSegmentId, activeReservoirId, segments, reservoirs])

  const resLinked = Boolean(activeReservoir?.shared_correlation)
  const segLinked = Boolean(activeSegment?.shared_correlation)

  return (
    <div className="ntg-sharing-panel">
      <p className="convention-inline" style={{ margin: '0 0 0.5rem' }}>
        <strong>Preferred:</strong> define <strong>uncertainty groups</strong> in Prospect Setup
        (e.g. <code>Poro_R1_S1,2</code> vs <code>Poro_R1_S3</code>) and set group ρ on the matrix
        above. <strong>Legacy linking</strong> (below) still copies this tank&apos;s correlation
        matrix to linked tanks when you edit.
      </p>
      <ul className="convention-inline" style={{ margin: '0 0 0.5rem', paddingLeft: '1.2rem' }}>
        <li>
          <strong>Corr↔Seg</strong> on a <em>reservoir</em> — all segments share the same
          per-tank correlation matrix (simple case).
        </li>
        <li>
          <strong>Corr↔Res</strong> on a <em>segment</em> (optional) — all reservoirs in that
          segment share per-tank correlations.
        </li>
      </ul>
      {(resLinked || segLinked) && (
        <p className="alert info" style={{ marginBottom: 0 }}>
          Active tank is linked with: <strong>{linkedCodes.join(', ')}</strong>. Edit
          correlations below — linked tanks update automatically. Porosity / saturation inputs
          on HC Yield stay per tank unless you also enable HC↔Seg there.
        </p>
      )}
      {!resLinked && !segLinked && activeReservoir && (
        <p className="alert warn" style={{ marginBottom: 0 }}>
          No correlation link on this tank. Enable <strong>Corr↔Seg</strong> on{' '}
          <strong>{activeReservoir.name}</strong> in Prospect Setup for R1-S1 / R1-S2 style
          groups, or leave off for an independent compartment (e.g. diagenesis).
        </p>
      )}
    </div>
  )
}
