import { useEffect, useRef, useState } from 'react'
import { PetrelCumulativeTornadoChart } from './PetrelCumulativeTornadoChart'
import { useWorkflow } from '../../context/WorkflowContext'
import { formatApiError } from '../../api/errors'
import type { PetrelCumulativeTornadoResponse } from '../../types/api'

interface PetrelCumulativeTornadoPanelProps {
  /** When true, render inside an outer card already; skip the wrapping card. */
  bare?: boolean
}

/** Shared deterministic OAT tornado panel: auto-runs on load, group/segment mode toggle. */
export function PetrelCumulativeTornadoPanel({ bare = false }: PetrelCumulativeTornadoPanelProps) {
  const {
    petrelCumulativeResult,
    setLoading,
    setError,
    loading,
    error,
    runPetrelCumulativeTornado,
  } = useWorkflow()
  const [tornado, setTornado] = useState<PetrelCumulativeTornadoResponse | null>(null)
  const [tornadoMode, setTornadoMode] = useState<'group' | 'segment'>('group')
  const [tankFilter, setTankFilter] = useState<string>('')
  const tornadoRequested = useRef(false)

  const tankOptions = petrelCumulativeResult?.segments ?? []

  const runTornado = async (
    mode: 'group' | 'segment' = tornadoMode,
    tankKey: string = tankFilter,
  ) => {
    setLoading(true)
    setError(null)
    try {
      const res = await runPetrelCumulativeTornado(mode, tankKey || null)
      setTornado(res)
    } catch (e) {
      setError(formatApiError(e, 'Tornado'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    tornadoRequested.current = false
    setTornado(null)
  }, [petrelCumulativeResult?.n_iterations, petrelCumulativeResult?.seed])

  useEffect(() => {
    if (!petrelCumulativeResult) return
    if (tornado || tornadoRequested.current) return
    tornadoRequested.current = true
    void runTornado('group', '')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per loaded result
  }, [petrelCumulativeResult, tornado])

  if (!petrelCumulativeResult) {
    return <p className="alert info">No Petrel cumulative run yet.</p>
  }

  const body = (
    <>
      <h3>Deterministic tornado (OAT)</h3>
      {error && <div className="alert error">{error}</div>}
      <div className="chart-select-row" style={{ marginBottom: '0.75rem' }}>
        <label className="toggle-row">
          <input
            type="radio"
            name="petrel-tornado-mode"
            checked={tornadoMode === 'group'}
            onChange={() => {
              setTornadoMode('group')
              void runTornado('group')
            }}
          />
          Group-level (recommended)
        </label>
        <label className="toggle-row" style={{ marginLeft: '1rem' }}>
          <input
            type="radio"
            name="petrel-tornado-mode"
            checked={tornadoMode === 'segment'}
            onChange={() => {
              setTornadoMode('segment')
              void runTornado('segment')
            }}
          />
          Segment-level
        </label>
        <label className="field-label" style={{ marginLeft: '1rem' }}>
          Scope
          <select
            value={tankFilter}
            onChange={(e) => {
              const next = e.target.value
              setTankFilter(next)
              void runTornado(tornadoMode, next)
            }}
          >
            <option value="">All tanks (field)</option>
            {tankOptions.map((s) => (
              <option key={s.tank_key} value={s.tank_key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          style={{ marginLeft: '1rem' }}
          onClick={() => runTornado(tornadoMode, tankFilter)}
          disabled={loading}
        >
          Re-run tornado
        </button>
      </div>
      {loading && !tornado && <p className="convention-inline">Computing OAT tornado…</p>}
      {tornado?.tornado.categories && <PetrelCumulativeTornadoChart tornado={tornado} />}

      {tornado?.tornado.structure_field_grv && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h4>Structure field GRV (deterministic)</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Low</th>
                <th>Mode</th>
                <th>High</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(tornado.tornado.structure_field_grv).map(([cat, v]) => (
                <tr key={cat}>
                  <td>{cat}</td>
                  <td>{v.low.toFixed(1)}</td>
                  <td>{v.mode.toFixed(1)}</td>
                  <td>{v.high.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )

  if (bare) return body
  return <div className="card">{body}</div>
}
