import { Link } from 'react-router-dom'
import { useWorkflow } from '../context/WorkflowContext'
import { buildTankRows } from '../utils/tankLabels'
import { listTanksInScope, tankCopyScopeLabel, type TankCopyScope } from '../utils/tankCopy'

/** GRV/NRV-only bulk actions — no petrophysics clutter. */
export function TankRockVolumeCopyPanel() {
  const {
    segments,
    reservoirs,
    activeSegmentId,
    activeReservoirId,
    copyActiveTankRockVolume,
    petroConstants,
  } = useWorkflow()

  if (!activeSegmentId || !activeReservoirId) return null

  const tankCount = buildTankRows(reservoirs, segments, () => undefined).length
  if (tankCount <= 1) return null

  const activeSeg = segments.find((s) => s.id === activeSegmentId)
  const activeRes = reservoirs.find((r) => r.id === activeReservoirId)

  const countInScope = (scope: TankCopyScope) =>
    listTanksInScope(scope, activeSegmentId, activeReservoirId, segments, reservoirs).length - 1

  return (
    <div className="tank-rock-copy-panel">
      <h3 style={{ marginTop: 0 }}>Copy rock volume from active tank</h3>
      <p className="convention-inline muted">
        Active: <strong>{activeSeg?.name}</strong> × <strong>{activeRes?.name}</strong>. Copies{' '}
        <strong>GRV / NRV / area / net pay only</strong> (not porosity or Sw). Each tank can still be
        edited individually afterward.
      </p>
      {petroConstants.ntg && (
        <p className="convention-inline muted">
          NTG is constant on Setup — rock volume uses <strong>direct NRV</strong> per tank.
        </p>
      )}
      <div className="btn-row">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => copyActiveTankRockVolume('reservoir')}
          disabled={countInScope('reservoir') < 1}
        >
          → this reservoir ({countInScope('reservoir')})
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => copyActiveTankRockVolume('segment')}
          disabled={countInScope('segment') < 1}
        >
          → this segment ({countInScope('segment')})
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => copyActiveTankRockVolume('all')}
          disabled={countInScope('all') < 1}
        >
          → all tanks ({countInScope('all')})
        </button>
        <Link to="/input/rock-volume#active-tank-editor">Rock volume editor</Link>
      </div>
      <p className="convention-inline muted" style={{ marginBottom: 0, fontSize: '0.82rem' }}>
        Scope: {tankCopyScopeLabel('reservoir')} · {tankCopyScopeLabel('segment')} ·{' '}
        {tankCopyScopeLabel('all')}.
      </p>
    </div>
  )
}
