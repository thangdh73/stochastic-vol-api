import { api } from '../api/client'
import type { ReservoirItem, ReservoirSegment, ValidationReport, ValidationIssue } from '../types/api'
import { prepareTankForApi } from './ensureSimulationReady'
import { tankId } from './tankLabels'
import type { SimulationInput } from '../types/api'

function tankLabel(
  key: string,
  segments: ReservoirSegment[],
  reservoirs: ReservoirItem[],
): string {
  const [sid, rid] = key.split('::')
  const seg = segments.find((s) => s.id === sid)
  const res = reservoirs.find((r) => r.id === rid)
  return `${res?.name ?? rid}–${seg?.name ?? sid}`
}

function prefixIssue(issue: ValidationIssue, label: string): ValidationIssue {
  return {
    ...issue,
    field: `${label} → ${issue.field}`,
    message: `[${label}] ${issue.message}`,
  }
}

/** Run full-case QA/QC on every tank; merge into one report for Simulation / Results. */
export async function validateAllTanks(
  tankInputs: Record<string, SimulationInput>,
  segments: ReservoirSegment[],
  reservoirs: ReservoirItem[],
): Promise<ValidationReport> {
  const keys = segments.flatMap((s) =>
    reservoirs.map((r) => tankId(s.id, r.id)),
  )
  const mergedIssues: ValidationIssue[] = []
  let hasErrors = false

  for (const key of keys) {
    const tank = tankInputs[key]
    if (!tank) {
      hasErrors = true
      mergedIssues.push({
        code: 'TANK_INPUT_MISSING',
        severity: 'ERROR',
        module: 'simulation_input',
        field: key,
        message: `[${tankLabel(key, segments, reservoirs)}] No input data for this tank.`,
        recommended_action: 'Open the tank on Input and enter rock volume / HC yield values.',
      })
      continue
    }
    const report = await api.validate(prepareTankForApi(tank))
    const label = tankLabel(key, segments, reservoirs)
    if (report.has_errors) hasErrors = true
    for (const issue of report.issues) {
      if (issue.severity === 'ERROR') hasErrors = true
      mergedIssues.push(prefixIssue(issue, label))
    }
  }

  if (keys.length === 0) {
    hasErrors = true
    mergedIssues.push({
      code: 'NO_TANKS',
      severity: 'ERROR',
      module: 'simulation_input',
      field: 'tanks',
      message: 'No segment × reservoir tanks defined.',
      recommended_action: 'Add at least one segment and reservoir on Setup.',
    })
  }

  return {
    schema_version: '1',
    has_errors: hasErrors,
    can_run_simulation: !hasErrors,
    issues: mergedIssues,
    input_hash: '',
  }
}
