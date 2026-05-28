import { useMemo } from 'react'
import { useWorkflow } from '../context/WorkflowContext'
import { buildTankRows } from '../utils/tankLabels'

function cell(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

/** Per-tank GRV / NTG snapshot — click row to edit that tank below. */
export function TankNrvMatrix() {
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
    <div className="card" style={{ marginBottom: '0.75rem' }}>
      <h3 style={{ marginTop: 0 }}>All tanks — NRV parameters</h3>
      <p className="convention-inline">
        Each row is a separate tank. Click a row to edit that tank in the form below.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Tank</th>
              <th>Segment</th>
              <th>Reservoir</th>
              <th>GRV P90</th>
              <th>GRV P50</th>
              <th>GRV P10</th>
              <th>GRV type</th>
              <th>NTG P90</th>
              <th>NTG P50</th>
              <th>NTG P10</th>
              <th>NTG type</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const ti = getTankInput(row.segmentId, row.reservoirId)
              const active =
                row.segmentId === activeSegmentId && row.reservoirId === activeReservoirId
              return (
                <tr
                  key={row.tankId}
                  className={active ? 'tank-matrix-row-active' : undefined}
                  style={{ cursor: 'pointer' }}
                  onClick={() => select(row.reservoirId, row.segmentId)}
                >
                  <td>
                    <strong>{row.tankCode}</strong>
                  </td>
                  <td>{row.segmentName}</td>
                  <td>{row.reservoirName}</td>
                  <td>{cell(ti?.grv_dist?.p90)}</td>
                  <td>{cell(ti?.grv_dist?.p50)}</td>
                  <td>{cell(ti?.grv_dist?.p10)}</td>
                  <td>{ti?.grv_dist?.distribution_type ?? '—'}</td>
                  <td>{cell(ti?.net_to_gross_dist?.p90)}</td>
                  <td>{cell(ti?.net_to_gross_dist?.p50)}</td>
                  <td>{cell(ti?.net_to_gross_dist?.p10)}</td>
                  <td>{ti?.net_to_gross_dist?.distribution_type ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
