import { LEGACY_WORKBOOK_LABEL } from '../constants/appBranding'
import { Link } from 'react-router-dom'
import { ValidationPanel } from '../components/ValidationPanel'
import { useWorkflow } from '../context/WorkflowContext'

export function QaqcPage() {
  const { validation, simulation } = useWorkflow()
  const hasCharts = Boolean(simulation?.result.arrays)

  return (
    <div>
      <h1 className="page-title">QA / QC</h1>
      <p className="page-desc">
        Pre-flight validation (workbook QA/QC module). Errors block simulation;
        warnings are advisory. Distribution and resource QC plots are on Charts
        after simulation.
      </p>

      {!validation && (
        <div className="alert info">
          <Link to="/simulation">Run QA/QC</Link> from the Simulation screen.
        </div>
      )}

      <div className="card">
        <h2>Validation report</h2>
        <ValidationPanel report={validation} />
      </div>

      <div className="card">
        <h2>Graphical QC (post-simulation)</h2>
        <p className="convention-inline">
          The {LEGACY_WORKBOOK_LABEL} includes ~31 charts (histograms, P99–P01 curves, scatter). The
          web app provides:
        </p>
        <ul className="chart-legend-list implemented">
          <li>Resource histogram &amp; exceedance with P90/P50/P10 markers</li>
          <li>Input marginal histograms (Area, Net Pay, porosity, etc.)</li>
          <li>Scatter / cross-plots with workbook presets</li>
        </ul>
        {hasCharts ? (
          <p>
            <Link to="/charts">Open Charts &amp; QC →</Link> for the current run.
          </p>
        ) : (
          <p className="alert info" style={{ marginTop: '0.75rem' }}>
            <Link to="/simulation">Run simulation</Link> to generate QC plots.
          </p>
        )}
      </div>
    </div>
  )
}
