import { useWorkflow } from '../context/WorkflowContext'
import type { DistributionSpec, SimulationInput } from '../types/api'
import { effectiveEstimatingMethod } from '../utils/estimatingMethod'
import { isNrvDirectFromNtgConstant } from '../utils/setupInputParams'
import { buildTankRows } from '../utils/tankLabels'

function fmt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

function fmtTriple(dist: DistributionSpec | null | undefined): string {
  if (!dist) return '—'
  if (dist.distribution_type === 'fixed') {
    return fmt(dist.fixed_value)
  }
  return `${fmt(dist.p90)} / ${fmt(dist.p50)} / ${fmt(dist.p10)}`
}

function shortType(dist: DistributionSpec | null | undefined): string {
  if (!dist?.distribution_type) return '—'
  const t = dist.distribution_type
  if (t === 'fixed') return 'Fixed'
  if (t === 'lognormal') return 'Logn'
  if (t === 'pert') return 'PERT'
  return t
}

function tankUsesDirectNrv(
  tank: SimulationInput | null | undefined,
  setupNtgConstant: boolean,
): boolean {
  if (!tank) return setupNtgConstant
  if (tank.nrv_entry_mode === 'direct') return true
  if (tank.nrv_entry_mode === 'petrel_marginals') return false
  if (tank.nrv_entry_mode === 'grv_fill_ntg') return false
  return setupNtgConstant
}

type InputRockVolumeTableProps = {
  /** Opens the distribution editor (parent hides/shows panel). */
  onEditTank?: (segmentId: string, reservoirId: string) => void
}

/** Compact one-row-per-tank rock volume summary (individual GRV/NRV per tank). */
export function InputRockVolumeTable({ onEditTank }: InputRockVolumeTableProps) {
  const {
    reservoirs,
    segments,
    activeSegmentId,
    activeReservoirId,
    setActiveReservoir,
    setActiveSegment,
    getTankInput,
    petroConstants,
    input,
  } = useWorkflow()

  const rows = buildTankRows(reservoirs, segments, (segmentId, reservoirId) =>
    getTankInput(segmentId, reservoirId)?.estimating_method,
  )
  const setupNtgConstant = isNrvDirectFromNtgConstant(petroConstants, input)
  const method = input ? effectiveEstimatingMethod(input) : 'nrv_grv_yield'

  const selectTank = (segmentId: string, reservoirId: string) => {
    setActiveSegment(segmentId)
    setActiveReservoir(reservoirId)
  }

  const anyDirect = rows.some((row) =>
    tankUsesDirectNrv(getTankInput(row.segmentId, row.reservoirId), setupNtgConstant),
  )
  const anyGrvBuild = rows.some(
    (row) => !tankUsesDirectNrv(getTankInput(row.segmentId, row.reservoirId), setupNtgConstant),
  )

  return (
    <div className="card input-rock-volume-card">
      <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem' }}>All tanks — rock volume</h2>
      <p className="convention-inline muted" style={{ margin: '0 0 0.5rem' }}>
        Click a row to select the active tank (editor opens below). P90 / P50 / P10 = low / mid / high.
        Use <strong>Edit</strong> to change distributions; click <strong>Done</strong> when finished.
      </p>

      <div className="input-rock-volume-scroll">
        <table className="data-table input-rock-volume-table">
          <thead>
            <tr>
              <th>Segment</th>
              <th>Reservoir</th>
              {anyDirect && (
                <>
                  <th>Net rock volume</th>
                  <th>Type</th>
                  <th>P90</th>
                  <th>P50</th>
                  <th>P10</th>
                </>
              )}
              {anyGrvBuild && method === 'nrv_grv_yield' && (
                <>
                  <th>GRV (P90/P50/P10)</th>
                  <th>GRV type</th>
                  <th>Fill (P90/P50/P10)</th>
                </>
              )}
              {anyGrvBuild && method === 'area_net_pay_yield' && (
                <>
                  <th>Area (P90/P50/P10)</th>
                  <th>Fill (P90/P50/P10)</th>
                  <th>Net pay (P90/P50/P10)</th>
                </>
              )}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const t = getTankInput(row.segmentId, row.reservoirId)
              const direct = tankUsesDirectNrv(t, setupNtgConstant)
              const active =
                row.segmentId === activeSegmentId && row.reservoirId === activeReservoirId
              const nrv = t?.nrv_direct_dist
              const grv = t?.grv_dist ?? t?.area_dist
              const fill = t?.grv_percent_fill_dist ?? t?.percent_fill_dist
              const netPay = t?.net_pay_dist

              return (
                <tr
                  key={row.tankId}
                  className={active ? 'input-tank-active' : undefined}
                  onClick={() => selectTank(row.segmentId, row.reservoirId)}
                >
                  <td>{row.segmentName}</td>
                  <td>{row.reservoirName}</td>
                  {anyDirect && (
                    <>
                      {direct ? (
                        <>
                          <td className="input-rock-primary">{fmtTriple(nrv)}</td>
                          <td>{shortType(nrv)}</td>
                          <td>{fmt(nrv?.p90 ?? nrv?.fixed_value)}</td>
                          <td>{fmt(nrv?.p50 ?? nrv?.fixed_value)}</td>
                          <td>{fmt(nrv?.p10 ?? nrv?.fixed_value)}</td>
                        </>
                      ) : (
                        <td colSpan={5} className="muted">
                          GRV × fill × NTG
                        </td>
                      )}
                    </>
                  )}
                  {anyGrvBuild && !direct && method === 'nrv_grv_yield' && (
                    <>
                      <td>{fmtTriple(grv)}</td>
                      <td>{shortType(grv)}</td>
                      <td>{fmtTriple(fill)}</td>
                    </>
                  )}
                  {anyGrvBuild && !direct && method === 'area_net_pay_yield' && (
                    <>
                      <td>{fmtTriple(grv)}</td>
                      <td>{fmtTriple(fill)}</td>
                      <td>{fmtTriple(netPay)}</td>
                    </>
                  )}
                  <td className="input-rock-edit-cell">
                    <button
                      type="button"
                      className="input-param-edit-link"
                      onClick={(e) => {
                        e.stopPropagation()
                        selectTank(row.segmentId, row.reservoirId)
                        onEditTank?.(row.segmentId, row.reservoirId)
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
