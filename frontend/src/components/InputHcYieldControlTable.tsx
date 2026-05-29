import { DistributionParamQcCells } from './DistributionParamQcCells'
import { HcYieldTableToolbar } from './HcYieldTableToolbar'
import { useWorkflow } from '../context/WorkflowContext'
import type { DistributionSpec, SimulationInput } from '../types/api'
import { ensureNrvDistributions } from '../utils/defaultInput'
import type { DistKey } from '../utils/inputHelpers'
import {
  hcYieldTableColumns,
  tankShowsNtgColumn,
} from '../utils/hcYieldControlColumns'
import { buildTankRows } from '../utils/tankLabels'
import { getHcYieldLinkedTankKeys } from '../utils/tankHcYieldShared'
import { getNtgLinkedTankKeys } from '../utils/tankNrvShared'

type Props = {
  onEditTank?: (segmentId: string, reservoirId: string) => void
}

function distForColumn(tank: SimulationInput, key: DistKey): DistributionSpec | null {
  const base = ensureNrvDistributions(tank)
  if (key === 'net_to_gross_dist') {
    return base.net_to_gross_dist ?? null
  }
  const value = base[key]
  return value && typeof value === 'object' && 'distribution_type' in value
    ? (value as DistributionSpec)
    : null
}

function columnVisibleForTank(
  key: DistKey,
  tank: SimulationInput | null,
  petroConstants: ReturnType<typeof useWorkflow>['petroConstants'],
): boolean {
  if (key === 'net_to_gross_dist') {
    return tankShowsNtgColumn(petroConstants, tank)
  }
  return Boolean(tank && distForColumn(tank, key))
}

/** QC review table — read-only values; edit via import or active-tank panel. */
export function InputHcYieldControlTable({ onEditTank }: Props) {
  const {
    reservoirs,
    segments,
    activeSegmentId,
    activeReservoirId,
    getTankInput,
    patchTankInput,
    setActiveTank,
    petroConstants,
    input,
  } = useWorkflow()

  if (!input) return null

  const rows = buildTankRows(reservoirs, segments, (segmentId, reservoirId) =>
    getTankInput(segmentId, reservoirId)?.estimating_method,
  )

  const anyTankNtg = rows.some((row) =>
    tankShowsNtgColumn(petroConstants, getTankInput(row.segmentId, row.reservoirId)),
  )
  const columns = hcYieldTableColumns(input, anyTankNtg)

  const selectTank = (segmentId: string, reservoirId: string) => {
    setActiveTank(segmentId, reservoirId)
  }

  const linkedBadge = (segmentId: string, reservoirId: string, key: DistKey) => {
    if (key === 'net_to_gross_dist') {
      return getNtgLinkedTankKeys(segmentId, reservoirId, segments, reservoirs).length > 1
    }
    return getHcYieldLinkedTankKeys(segmentId, reservoirId, segments, reservoirs).length > 1
  }

  return (
    <div className="card input-qc-table-card">
      <div className="input-qc-table-head">
        <div>
          <h2 className="input-control-table-title">Petrophysical &amp; fluid uncertainties</h2>
          <p className="convention-inline muted" style={{ margin: 0 }}>
            QC summary — click a row to select tank. Use <strong>Import</strong> for bulk entry or{' '}
            <strong>Edit</strong> for one tank.
          </p>
        </div>
      </div>

      <HcYieldTableToolbar
        columns={columns}
        rows={rows}
        getTankInput={getTankInput}
        patchTankInput={patchTankInput}
        getDist={distForColumn}
      />

      <div className="input-qc-table-scroll">
        <table className="data-table input-qc-table">
          <thead>
            <tr>
              <th colSpan={3} className="qc-id-group">
                Tank
              </th>
              {columns.map((col) => (
                <th key={col.key} colSpan={4} className="qc-param-group">
                  {col.label}
                  {col.key === 'porosity_dist' ||
                  col.key === 'saturation_dist' ||
                  col.key === 'net_to_gross_dist'
                    ? ' (frac)'
                    : ''}
                </th>
              ))}
              <th rowSpan={2} className="qc-edit-col">
                {' '}
              </th>
            </tr>
            <tr>
              <th className="qc-id-col qc-sticky">Segment</th>
              <th className="qc-id-col qc-sticky">Reservoir</th>
              <th className="qc-id-col qc-sticky">Unique ID</th>
              {columns.map((col) => (
                <th key={col.key} colSpan={4} className="qc-subhead">
                  <span>L</span>
                  <span>B</span>
                  <span>H</span>
                  <span>Type</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const tank = getTankInput(row.segmentId, row.reservoirId)
              const active =
                row.segmentId === activeSegmentId && row.reservoirId === activeReservoirId
              const hasLink = columns.some((col) =>
                linkedBadge(row.segmentId, row.reservoirId, col.key),
              )

              return (
                <tr
                  key={row.tankId}
                  className={active ? 'input-tank-active' : undefined}
                  onClick={() => selectTank(row.segmentId, row.reservoirId)}
                >
                  <td className="qc-id-col qc-sticky">{row.segmentName}</td>
                  <td className="qc-id-col qc-sticky">{row.reservoirName}</td>
                  <td className="qc-id-col qc-sticky">
                    <span className="input-control-unique-id" title={row.uniqueId}>
                      {row.uniqueId}
                    </span>
                    {hasLink && (
                      <span className="input-control-linked-badge" title="Linked group">
                        ↔
                      </span>
                    )}
                  </td>
                  {columns.map((col) => {
                    const visible = columnVisibleForTank(col.key, tank, petroConstants)
                    const dist = tank && visible ? distForColumn(tank, col.key) : null
                    return (
                      <DistributionParamQcCells
                        key={col.key}
                        dist={visible ? dist : null}
                        asPercent={col.asPercent}
                      />
                    )
                  })}
                  <td className="qc-edit-col" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="input-param-edit-link"
                      onClick={() => {
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
