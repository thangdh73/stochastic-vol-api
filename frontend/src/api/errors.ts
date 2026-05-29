import type { ValidationReport } from '../types/api'

function validationSummary(report: ValidationReport | undefined): string | undefined {
  if (!report?.issues?.length) return undefined
  const errors = report.issues.filter((i) => i.severity === 'ERROR')
  const first = errors[0] ?? report.issues[0]
  const more = errors.length > 1 ? ` (+${errors.length - 1} more)` : ''
  return `${first.message}${first.recommended_action ? ` — ${first.recommended_action}` : ''}${more}`
}

const API_DOWN_HINT =
  'The calculation API is not reachable on port 8002. From the project root run start-dev.bat (or start the "Stochastic Vol API (8002)" window). Check http://127.0.0.1:8002/health in the browser.'

/** Turn API error payloads into readable messages for the UI. */
export function formatApiError(err: unknown, context?: string): string {
  const raw = err instanceof Error ? err.message : String(err)
  const status =
    err instanceof Error && 'status' in err
      ? (err as Error & { status?: number }).status
      : undefined

  if (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    /bad gateway|ECONNREFUSED|Failed to fetch|NetworkError/i.test(raw)
  ) {
    const prefix = context ? `${context}. ` : ''
    return `${prefix}${API_DOWN_HINT}`
  }

  let detail: string | undefined
  let statusHint: string | undefined
  let validation: ValidationReport | undefined

  try {
    const parsed = JSON.parse(raw) as { detail?: unknown }
    if (typeof parsed.detail === 'string') {
      detail = parsed.detail
      if (parsed.detail === 'Not Found') {
        statusHint = 'not_found'
      }
    } else if (parsed.detail && typeof parsed.detail === 'object') {
      const d = parsed.detail as { message?: string; validation?: ValidationReport }
      validation = d.validation
      const valMsg = validationSummary(validation)
      detail = valMsg ?? d.message ?? JSON.stringify(parsed.detail)
    }
  } catch {
    detail = raw
  }

  if (statusHint === 'not_found') {
    const ctx = context ? ` (${context})` : ''
    return (
      `API endpoint not found${ctx}. The calculation API on port 8002 is running old code or the wrong app. ` +
      'Stop any process on port 8002, then from the backend folder run: ' +
      'start-api.ps1  (or: uvicorn app.main:app --reload --reload-dir . --reload-dir "..\\engine" --host 127.0.0.1 --port 8002). ' +
      'Check /health includes api_features "tornado_perturbation".'
    )
  }

  if (detail) return context ? `${context}: ${detail}` : detail
  return context ? `${context}: ${raw}` : raw
}

export function apiSupportsModulePreview(
  health: { api_features?: string[] } | undefined,
): boolean {
  return Boolean(health?.api_features?.includes('simulate_preview'))
}

export function apiSupportsPerturbationTornado(
  health: { api_features?: string[] } | undefined,
): boolean {
  return Boolean(health?.api_features?.includes('tornado_perturbation'))
}

export const PERTURBATION_TORNADO_RESTART_HINT =
  'Stop the old API on port 8002, then run start-api.ps1 from the backend folder (or start-dev.bat from the project root).'
