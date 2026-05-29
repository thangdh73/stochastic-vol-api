import { Link } from 'react-router-dom'
import { useWorkflow } from '../context/WorkflowContext'
import { buildTankRows } from '../utils/tankLabels'
import { listTanksInScope, tankCopyScopeLabel, type TankCopyScope } from '../utils/tankCopy'

export function TankBulkCopyPanel() {
  const {
    segments,
    reservoirs,
    activeSegmentId,
    activeReservoirId,
    copyActiveTankDistributions,
    copyNrvNtgFromActive,
  } = useWorkflow()

  if (!activeSegmentId || !activeReservoirId) return null

  const tankCount = buildTankRows(reservoirs, segments, () => undefined).length
  if (tankCount <= 1) return null

  const activeSeg = segments.find((s) => s.id === activeSegmentId)
  const activeRes = reservoirs.find((r) => r.id === activeReservoirId)

  const countInScope = (scope: TankCopyScope) =>
    listTanksInScope(scope, activeSegmentId, activeReservoirId, segments, reservoirs).length - 1

  const runCopy = (scope: TankCopyScope) => {
    copyActiveTankDistributions(scope)
  }

  return (
    <div className="card tank-bulk-copy-panel">
      <h2>Many tanks ({tankCount} total)</h2>
      <p className="convention-inline">
        Each <strong>segment × reservoir</strong> has its own distributions. You do not enter 900
        tables by hand — use <strong>linking</strong> (auto-sync while you edit) and{' '}
        <strong>copy</strong> (one-time push from the active tank).
      </p>

      <div className="tank-bulk-copy-grid">
        <div>
          <h3>1. Link groups (recommended)</h3>
          <p className="convention-inline muted">
            On <Link to="/prospect">Prospect Setup → Groups / metadata</Link> (reservoir &amp;
            segment manager):
          </p>
          <ul className="tank-bulk-copy-list">
            <li>
              <strong>NTG↔Seg</strong> on a reservoir — one NTG distribution for all segments in
              that reservoir (e.g. R1-S1 … R1-S30).
            </li>
            <li>
              <strong>HC↔Seg</strong> — porosity, Sw, Bo/GEF shared the same way.
            </li>
            <li>
              <strong>NTG↔Res / HC↔Res</strong> on a segment — share across reservoirs in one
              segment (optional).
            </li>
          </ul>
          <p className="convention-inline muted">
            After linking, edit once on the active tank — linked tanks update automatically. GRV /
            area / net pay stay separate per tank unless you copy them.
          </p>
        </div>

        <div>
          <h3>2. Copy from active tank</h3>
          <p className="convention-inline muted">
            Active: <strong>{activeSeg?.name ?? 'Segment'}</strong> ×{' '}
            <strong>{activeRes?.name ?? 'Reservoir'}</strong>. Copies all distribution types and
            P90/P50/P10 (or fixed values) to:
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => runCopy('reservoir')}
              disabled={countInScope('reservoir') < 1}
            >
              Copy to reservoir ({countInScope('reservoir')} tanks)
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => runCopy('segment')}
              disabled={countInScope('segment') < 1}
            >
              Copy to segment ({countInScope('segment')} tanks)
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => runCopy('all')}
              disabled={countInScope('all') < 1}
            >
              Copy to all ({countInScope('all')} tanks)
            </button>
          </div>
          <p className="convention-inline muted">
            Overwrites targets in {tankCopyScopeLabel('all').replace('every', 'the chosen')}. Use
            after you finish a template tank.
          </p>
        </div>

        <div>
          <h3>3. Review on Input</h3>
          <p className="convention-inline muted">
            Scroll the table below to spot outliers. Use <strong>NRV / GRV → All tanks</strong>{' '}
            matrix to jump between tanks. Advanced:{' '}
            <Link to="/prospect">Uncertainty groups</Link> for compartment-level GRV / Poro / Sw.
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => copyNrvNtgFromActive('reservoir')}
            >
              Copy NTG only → this reservoir
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => copyNrvNtgFromActive('all')}
            >
              Copy NTG only → all tanks
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
