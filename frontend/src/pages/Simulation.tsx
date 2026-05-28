import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { formatApiError } from '../api/errors'
import { InputSummary } from '../components/InputSummary'
import { InputScopeBadge } from '../components/InputScopeBadge'
import { ValidateBar } from '../components/ValidateBar'
import { ValidationPanel } from '../components/ValidationPanel'
import { useWorkflow } from '../context/WorkflowContext'

export function SimulationPage() {
  const navigate = useNavigate()
  const {
    input,
    segments,
    reservoirs,
    validation,
    loading,
    error,
    setValidation,
    setSimulation,
    setLoading,
    setError,
    getGroupDependencyContext,
  } = useWorkflow()
  const [saveName, setSaveName] = useState('')

  useEffect(() => {
    if (input?.prospect_name) setSaveName(input.prospect_name)
  }, [input?.prospect_name])

  // Clear a prior API error banner when reopening this page after a fix/reload.
  useEffect(() => {
    setError(null)
  }, [])

  const runValidate = async () => {
    if (!input) return
    setLoading(true)
    setError(null)
    try {
      const report = await api.validate(input)
      setValidation(report)
    } catch (e) {
      setError(formatApiError(e, 'QA/QC'))
    } finally {
      setLoading(false)
    }
  }

  const runSimulate = async () => {
    if (!input) return
    setLoading(true)
    setError(null)
    try {
      const report = await api.validate(input)
      setValidation(report)
      if (report.has_errors) {
        setError('Simulation blocked: fix validation errors first.')
        return
      }
      const result = await api.simulate(input, true, getGroupDependencyContext() ?? undefined)
      setSimulation(result)
      navigate('/results')
    } catch (e) {
      setError(formatApiError(e, 'Simulation'))
    } finally {
      setLoading(false)
    }
  }

  const saveAndRun = async () => {
    if (!input || !saveName.trim()) return
    setLoading(true)
    setError(null)
    try {
      const prospect = await api.createProspect(saveName.trim(), {
        basin: input.basin,
        formation: input.formation,
      })
      const result = await api.persistSimulation(prospect.id, input)
      setValidation(result.validation)
      setSimulation(result)
      navigate('/results')
    } catch (e) {
      setError(formatApiError(e, 'Save and simulate'))
    } finally {
      setLoading(false)
    }
  }

  const canSimulate = input && validation && !validation.has_errors

  return (
    <div>
      <h1 className="page-title">Simulation</h1>
      <p className="page-desc">
        Monte Carlo run lives here and on every input page (blue{' '}
        <strong>Run simulation</strong> in the QA/QC bar). Sidebar:{' '}
        <strong>Simulation</strong> (between Correlations and Results).
      </p>
      {segments.length * reservoirs.length > 1 && (
        <div className="alert info">
          Multi-tank mode: simulation rolls up all tank inputs in this prospect context.
          Uncertainty groups control dependency structure; non-grouped parameters stay
          tank-level.
        </div>
      )}

      {error && <div className="alert error">{error}</div>}
      <InputScopeBadge />

      <div className="card">
        <h2>Actions</h2>
        <div className="btn-row">
          <button type="button" onClick={runValidate} disabled={loading || !input}>
            Run QA/QC
          </button>
          <button
            type="button"
            className="primary"
            onClick={runSimulate}
            disabled={loading || !input || (validation?.has_errors ?? false)}
          >
            Run simulation
          </button>
        </div>
        {validation?.has_errors && (
          <p className="alert warn">Errors block simulation. Review QA/QC tab.</p>
        )}
        {input && !validation && (
          <p className="alert info">Run QA/QC before simulation (recommended).</p>
        )}
      </div>

      {input && (
        <div className="card">
          <h2>Save &amp; run</h2>
          <p className="convention-inline">
            Save inputs on the <Link to="/">Dashboard</Link> first. Here you can save and
            run Monte Carlo in one step (stores results in the database).
          </p>
          <div className="btn-row">
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Project name"
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: 6,
                border: '1px solid #c5d0dc',
                minWidth: 220,
              }}
            />
            <button
              type="button"
              onClick={saveAndRun}
              disabled={loading || !canSimulate || !saveName.trim()}
            >
              Save project &amp; run
            </button>
          </div>
        </div>
      )}

      <ValidateBar />

      <div className="card">
        <h2>Input summary</h2>
        <p style={{ fontSize: '0.85rem', color: '#5a6b7d' }}>
          Edit inputs on Prospect, Area, Net Pay, HC Yield, and Chance screens — changes
          apply here automatically.
        </p>
        {input ? <InputSummary input={input} /> : <p>No input loaded.</p>}
      </div>

      <div className="card">
        <h2>Validation preview</h2>
        <ValidationPanel report={validation} />
      </div>
    </div>
  )
}
