import { useMemo, useState } from 'react'
import type { ReservoirSegmentType } from '../types/api'
import { useWorkflow } from '../context/WorkflowContext'
import { buildTankRows } from '../utils/tankLabels'

const SEGMENT_TYPE_OPTIONS: Array<{ id: ReservoirSegmentType; label: string }> = [
  { id: 'fault_block', label: 'Fault Block' },
  { id: 'geobody', label: 'Geobody' },
  { id: 'compartment', label: 'Compartment' },
  { id: 'other', label: 'Other' },
]

export function ReservoirSegmentManager() {
  const {
    reservoirs,
    segments,
    activeReservoirId,
    activeSegmentId,
    addReservoir,
    renameReservoir,
    toggleReservoir,
    toggleReservoirSharedSimulation,
    toggleReservoirSharedNtg,
    toggleSegmentSharedNtg,
    toggleReservoirSharedHcYield,
    toggleSegmentSharedHcYield,
    toggleReservoirSharedCorrelation,
    toggleSegmentSharedCorrelation,
    removeReservoir,
    moveReservoir,
    setActiveReservoir,
    addSegment,
    renameSegment,
    setSegmentType,
    removeSegment,
    moveSegment,
    setActiveSegment,
    getTankInput,
  } = useWorkflow()

  const [draftReservoirNames, setDraftReservoirNames] = useState<Record<string, string>>({})
  const [draftSegmentNames, setDraftSegmentNames] = useState<Record<string, string>>({})
  const totalTanks = reservoirs.length * segments.length
  const tankRows = useMemo(
    () =>
      buildTankRows(
        reservoirs,
        segments,
        (segmentId, reservoirId) =>
          getTankInput(segmentId, reservoirId)?.estimating_method,
      ),
    [reservoirs, segments, getTankInput],
  )

  const selectTank = (reservoirId: string, segmentId: string) => {
    setActiveReservoir(reservoirId)
    setActiveSegment(segmentId)
  }

  return (
    <div className="card">
      <h2>Reservoir and segment manager</h2>
      <p className="convention-inline">
        For porosity compartments, GRV drivers, and group-level correlations, use the{' '}
        <strong>Dependency groups</strong> tab (preferred). Link checkboxes here are a simple
        legacy way to copy NTG, HC yield, or per-tank ρ across tanks.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.85rem',
          alignItems: 'start',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h3 style={{ marginTop: 0 }}>Segments</h3>
          <table className="data-table">
            <tbody>
              {segments.map((seg) => {
                const value = draftSegmentNames[seg.id] ?? seg.name
                return (
                  <tr key={seg.id}>
                    <td style={{ width: 24 }}>
                      <input
                        type="radio"
                        checked={activeSegmentId === seg.id}
                        onChange={() => setActiveSegment(seg.id)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) =>
                          setDraftSegmentNames((prev) => ({ ...prev, [seg.id]: e.target.value }))
                        }
                        onBlur={() => renameSegment(seg.id, value)}
                      />
                    </td>
                    <td>
                      <select
                        value={seg.type}
                        onChange={(e) => setSegmentType(seg.id, e.target.value as ReservoirSegmentType)}
                      >
                        {SEGMENT_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(seg.shared_ntg)}
                          onChange={() => toggleSegmentSharedNtg(seg.id)}
                          title="Link NTG across all reservoirs in this segment (optional)"
                        />
                        <span style={{ fontSize: 12 }}>NTG↔Res</span>
                      </label>
                    </td>
                    <td>
                      <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(seg.shared_hc_yield)}
                          onChange={() => toggleSegmentSharedHcYield(seg.id)}
                          title="Link HC yield across all reservoirs in this segment (optional)"
                        />
                        <span style={{ fontSize: 12 }}>HC↔Res</span>
                      </label>
                    </td>
                    <td>
                      <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(seg.shared_correlation)}
                          onChange={() => toggleSegmentSharedCorrelation(seg.id)}
                          title="Link correlations across all reservoirs in this segment (optional)"
                        />
                        <span style={{ fontSize: 12 }}>Corr↔Res</span>
                      </label>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="btn-row" style={{ marginTop: '0.5rem' }}>
            <button type="button" className="btn-secondary" onClick={() => addSegment()}>
              +
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => activeSegmentId && moveSegment(activeSegmentId, 'up')}
              disabled={!activeSegmentId}
            >
              ↑
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => activeSegmentId && moveSegment(activeSegmentId, 'down')}
              disabled={!activeSegmentId}
            >
              ↓
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => activeSegmentId && removeSegment(activeSegmentId)}
              disabled={!activeSegmentId || segments.length <= 1}
            >
              ×
            </button>
          </div>
        </div>

        <div>
          <h3 style={{ marginTop: 0 }}>Reservoirs</h3>
          <table className="data-table">
            <tbody>
              {reservoirs.map((res) => {
                const value = draftReservoirNames[res.id] ?? res.name
                return (
                  <tr key={res.id}>
                    <td style={{ width: 24 }}>
                      <input
                        type="checkbox"
                        checked={res.enabled}
                        onChange={() => toggleReservoir(res.id)}
                      />
                    </td>
                    <td style={{ width: 24 }}>
                      <input
                        type="radio"
                        checked={activeReservoirId === res.id}
                        onChange={() => setActiveReservoir(res.id)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) =>
                          setDraftReservoirNames((prev) => ({ ...prev, [res.id]: e.target.value }))
                        }
                        onBlur={() => renameReservoir(res.id, value)}
                      />
                    </td>
                    <td>
                      <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={res.shared_simulation}
                          onChange={() => toggleReservoirSharedSimulation(res.id)}
                        />
                        <span style={{ fontSize: 12 }}>Sim</span>
                      </label>
                    </td>
                    <td>
                      <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(res.shared_ntg)}
                          onChange={() => toggleReservoirSharedNtg(res.id)}
                          title="Link NTG for all segments in this reservoir (R1-S1, R1-S2, …)"
                        />
                        <span style={{ fontSize: 12 }}>NTG↔Seg</span>
                      </label>
                    </td>
                    <td>
                      <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(res.shared_hc_yield)}
                          onChange={() => toggleReservoirSharedHcYield(res.id)}
                          title="Link HC yield for all segments in this reservoir (R1-S1, R1-S2, …)"
                        />
                        <span style={{ fontSize: 12 }}>HC↔Seg</span>
                      </label>
                    </td>
                    <td>
                      <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(res.shared_correlation)}
                          onChange={() => toggleReservoirSharedCorrelation(res.id)}
                          title="Link correlations for all segments in this reservoir (R1-S1, R1-S2, …)"
                        />
                        <span style={{ fontSize: 12 }}>Corr↔Seg</span>
                      </label>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="btn-row" style={{ marginTop: '0.5rem' }}>
            <button type="button" className="btn-secondary" onClick={addReservoir}>
              +
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => activeReservoirId && moveReservoir(activeReservoirId, 'up')}
              disabled={!activeReservoirId}
            >
              ↑
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => activeReservoirId && moveReservoir(activeReservoirId, 'down')}
              disabled={!activeReservoirId}
            >
              ↓
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => activeReservoirId && removeReservoir(activeReservoirId)}
              disabled={!activeReservoirId || reservoirs.length <= 1}
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <h3 style={{ marginTop: 0, borderTop: '1px solid #d7dde5', paddingTop: '0.75rem' }}>
        All tanks
      </h3>
      <p className="convention-inline" style={{ marginBottom: '0.6rem' }}>
        Result: <strong>{totalTanks}</strong> tanks ({segments.length} segments × {reservoirs.length}{' '}
        reservoirs). Use <strong>Link NTG</strong> on each reservoir so all segments in that
        reservoir share NTG (e.g. R1-S1 and R1-S2 together; R2-S1 and R2-S2 together).
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Tank ID</th>
            <th>Reservoir</th>
            <th>Segment</th>
            <th>Unique ID</th>
            <th>Method</th>
            <th>Active</th>
          </tr>
        </thead>
        <tbody>
          {tankRows.map((row) => {
            const isActive =
              row.segmentId === activeSegmentId && row.reservoirId === activeReservoirId
            return (
              <tr
                key={row.tankId}
                style={{
                  cursor: 'pointer',
                  background: isActive ? 'rgba(37, 99, 235, 0.08)' : undefined,
                }}
                onClick={() => selectTank(row.reservoirId, row.segmentId)}
              >
                <td>
                  <strong>{row.tankCode}</strong>
                </td>
                <td>{row.reservoirName}</td>
                <td>{row.segmentName}</td>
                <td>{row.uniqueId}</td>
                <td style={{ fontSize: 12 }}>{row.method}</td>
                <td>{isActive ? '●' : ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
