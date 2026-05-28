import type { ValidationReport } from '../types/api'

interface ValidationPanelProps {
  report: ValidationReport | null
}

export function ValidationPanel({ report }: ValidationPanelProps) {
  if (!report) {
    return (
      <p style={{ color: '#5a6b7d', fontSize: '0.88rem' }}>
        Run validation to see QA/QC issues.
      </p>
    )
  }

  const errors = report.issues.filter((i) => i.severity === 'ERROR')
  const warnings = report.issues.filter((i) => i.severity === 'WARNING')
  const infos = report.issues.filter((i) => i.severity === 'INFO')

  return (
    <div>
      <div className="btn-row" style={{ marginBottom: '0.75rem' }}>
        <span className={`badge ${report.has_errors ? 'error' : 'ok'}`} style={{ background: report.has_errors ? undefined : '#e8f5e9', color: report.has_errors ? undefined : '#2e5c32' }}>
          {report.has_errors ? 'Blocked' : 'Can simulate'}
        </span>
        <span className="badge error">{errors.length} errors</span>
        <span className="badge warning">{warnings.length} warnings</span>
        <span className="badge info">{infos.length} info</span>
      </div>
      {report.issues.length === 0 ? (
        <p className="alert ok">No validation issues.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Severity</th>
              <th>Field</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {report.issues.map((issue, idx) => (
              <tr key={`${issue.code}-${idx}`}>
                <td>
                  <span className={`badge ${issue.severity.toLowerCase()}`}>
                    {issue.severity}
                  </span>
                </td>
                <td>{issue.field}</td>
                <td style={{ textAlign: 'left' }}>{issue.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
