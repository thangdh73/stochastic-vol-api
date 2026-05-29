import type { CorrelationMatrix, CorrelationPair, SimulationInput } from '../types/api'
import { applyOilRecovery, includeSolutionGas } from './calculationToggles'
import { effectiveEstimatingMethod } from './estimatingMethod'

/** Recommended pairs — Area × Net Pay method. */
export const RECOMMENDED_PAIRS_AREA: { a: string; b: string; label: string }[] = [
  { a: 'area', b: 'net_pay', label: 'Area ↔ Net pay' },
  { a: 'porosity', b: 'saturation', label: 'Porosity ↔ HC saturation' },
  { a: 'porosity', b: 'oil_recovery', label: 'Porosity ↔ Oil recovery' },
  { a: 'fvf', b: 'gor', label: 'Oil FVF ↔ GOR' },
]

/** Recommended pairs — NRV / GRV method. */
export const RECOMMENDED_PAIRS_NRV: { a: string; b: string; label: string }[] = [
  { a: 'grv', b: 'net_to_gross', label: 'GRV ↔ Net/Gross' },
  { a: 'porosity', b: 'saturation', label: 'Porosity ↔ HC saturation' },
  { a: 'porosity', b: 'oil_recovery', label: 'Porosity ↔ Oil recovery' },
  { a: 'fvf', b: 'gor', label: 'Oil FVF ↔ GOR' },
]

export const VARIABLE_LABELS: Record<string, string> = {
  area: 'Closed area',
  percent_fill: 'Percent fill',
  net_pay: 'Net pay',
  geometric_correction: 'Geometric correction',
  grv: 'GRV (acre-ft)',
  petrel_grv_depth: 'Depth / structure (Petrel)',
  petrel_grv_contact: 'Fluid contact (Petrel)',
  grv_percent_fill: 'Percent trap fill',
  net_to_gross: 'Net/Gross',
  nrv_direct: 'NRV direct (acre-ft)',
  porosity: 'Porosity',
  saturation: 'HC saturation',
  oil_recovery: 'Oil recovery',
  fvf: 'Oil FVF',
  gor: 'GOR',
  solution_gas_recovery: 'Solution gas recovery',
  gas_recovery: 'Gas recovery',
  gef: 'Gas expansion factor',
  condensate_yield: 'Condensate yield',
}

const AREA_VOLUMETRIC = [
  'area',
  'percent_fill',
  'net_pay',
  'geometric_correction',
] as const

const NRV_VOLUMETRIC_GRV = ['grv', 'grv_percent_fill', 'net_to_gross'] as const
const NRV_VOLUMETRIC_PETREL = ['petrel_grv_depth', 'petrel_grv_contact', 'net_to_gross'] as const
const NRV_VOLUMETRIC_DIRECT = ['nrv_direct'] as const

const HC_COMMON = ['porosity', 'saturation'] as const
const OIL_HC = ['oil_recovery', 'fvf', 'gor', 'solution_gas_recovery'] as const
const GAS_HC = ['gas_recovery', 'gef', 'condensate_yield'] as const

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

function hcVariables(input: SimulationInput): string[] {
  const ft = input.fluid_type.toLowerCase()
  let ids: string[] = [...HC_COMMON]
  if (ft === 'oil') {
    let oilIds = [...OIL_HC]
    if (!includeSolutionGas(input)) {
      oilIds = oilIds.filter((v) => v !== 'gor' && v !== 'solution_gas_recovery')
    }
    if (!applyOilRecovery(input)) {
      oilIds = oilIds.filter((v) => v !== 'oil_recovery')
    }
    ids = [...ids, ...oilIds]
  } else if (ft === 'gas' || ft === 'gas_condensate') {
    ids = [...ids, ...GAS_HC]
    if (!input.condensate_yield_dist) ids = ids.filter((v) => v !== 'condensate_yield')
  } else {
    ids = [...ids, ...OIL_HC]
  }
  return ids
}

/** Variable IDs for the correlation matrix (matches engine). */
export function correlatableVariables(input: SimulationInput): string[] {
  const method = effectiveEstimatingMethod(input)
  if (method === 'nrv_grv_yield') {
    const mode = input.nrv_entry_mode ?? 'grv_fill_ntg'
    const vol =
      mode === 'direct'
        ? [...NRV_VOLUMETRIC_DIRECT]
        : mode === 'petrel_marginals'
          ? [...NRV_VOLUMETRIC_PETREL]
          : [...NRV_VOLUMETRIC_GRV]
    return [...vol, ...hcVariables(input)]
  }
  return [...AREA_VOLUMETRIC, ...hcVariables(input)]
}

/** Drop pairs that do not apply to the current estimating method. */
export function pruneCorrelationsForMethod(input: SimulationInput): SimulationInput {
  const active = new Set(correlatableVariables(input))
  const correlations = (input.correlations ?? []).filter(
    (p) => active.has(p.variable_a) && active.has(p.variable_b),
  )
  return syncCorrelationMatrix({ ...input, correlations })
}

export function findPair(
  correlations: CorrelationPair[],
  a: string,
  b: string,
): CorrelationPair | undefined {
  const key = pairKey(a, b)
  return correlations.find((p) => pairKey(p.variable_a, p.variable_b) === key)
}

export function upsertPair(
  correlations: CorrelationPair[],
  a: string,
  b: string,
  patch: Partial<CorrelationPair>,
): CorrelationPair[] {
  const key = pairKey(a, b)
  const idx = correlations.findIndex(
    (p) => pairKey(p.variable_a, p.variable_b) === key,
  )
  const base: CorrelationPair = {
    variable_a: a,
    variable_b: b,
    rho: 0,
    enabled: false,
    notes: '',
  }
  if (idx >= 0) {
    const next = [...correlations]
    next[idx] = { ...next[idx], ...patch, variable_a: a, variable_b: b }
    return next
  }
  return [...correlations, { ...base, ...patch }]
}

export function matrixCellRho(
  correlations: CorrelationPair[],
  rowVar: string,
  colVar: string,
): number {
  if (rowVar === colVar) return 1
  const pair = findPair(correlations, rowVar, colVar)
  if (!pair?.enabled) return 0
  return pair.rho
}

export function buildCorrelationMatrix(input: SimulationInput): CorrelationMatrix {
  const variables = correlatableVariables(input)
  const k = variables.length
  const values: number[][] = Array.from({ length: k }, (_, i) =>
    Array.from({ length: k }, (_, j) =>
      matrixCellRho(input.correlations ?? [], variables[i], variables[j]),
    ),
  )
  return { variables, values }
}

export function syncCorrelationMatrix(input: SimulationInput): SimulationInput {
  return { ...input, correlation_matrix: buildCorrelationMatrix(input) }
}

export function setMatrixCell(
  input: SimulationInput,
  rowVar: string,
  colVar: string,
  rho: number,
): SimulationInput {
  if (rowVar === colVar) return input
  const clamped = Math.max(-1, Math.min(1, rho))
  const enabled = Math.abs(clamped) > 1e-6
  const correlations = upsertPair(input.correlations ?? [], rowVar, colVar, {
    rho: enabled ? clamped : 0,
    enabled,
  })
  return syncCorrelationMatrix({ ...input, correlations })
}

export function pairsFromMatrix(matrix: CorrelationMatrix): CorrelationPair[] {
  const { variables, values } = matrix
  const k = variables.length
  const pairs: CorrelationPair[] = []
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const rho = values[i]?.[j] ?? 0
      if (Math.abs(rho) > 1e-6) {
        pairs.push({
          variable_a: variables[i],
          variable_b: variables[j],
          rho,
          enabled: true,
        })
      }
    }
  }
  return pairs
}

export function applyMatrixToInput(
  input: SimulationInput,
  matrix: CorrelationMatrix,
): SimulationInput {
  const existing = input.correlations ?? []
  const fromMatrix = pairsFromMatrix(matrix)
  let correlations = [...existing]

  for (const p of fromMatrix) {
    correlations = upsertPair(correlations, p.variable_a, p.variable_b, {
      rho: p.rho,
      enabled: true,
    })
  }

  const k = matrix.variables.length
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const rho = matrix.values[i]?.[j] ?? 0
      if (Math.abs(rho) <= 1e-6) {
        correlations = upsertPair(
          correlations,
          matrix.variables[i],
          matrix.variables[j],
          { rho: 0, enabled: false },
        )
      }
    }
  }

  return syncCorrelationMatrix({ ...input, correlations })
}

export function recommendedPairsForInput(input: SimulationInput) {
  const method = effectiveEstimatingMethod(input)
  if (method === 'nrv_grv_yield') {
    const ft = input.fluid_type.toLowerCase()
    if (ft === 'gas' || ft === 'gas_condensate') {
      return RECOMMENDED_PAIRS_NRV.filter(
        (p) => p.a !== 'porosity' || p.b !== 'oil_recovery',
      )
    }
    return RECOMMENDED_PAIRS_NRV
  }
  return RECOMMENDED_PAIRS_AREA
}

export function addRecommendedPairs(input: SimulationInput): SimulationInput {
  let correlations = [...(input.correlations ?? [])]
  for (const rec of recommendedPairsForInput(input)) {
    if (!findPair(correlations, rec.a, rec.b)) {
      correlations = upsertPair(correlations, rec.a, rec.b, {
        rho: 0,
        enabled: false,
      })
    }
  }
  return syncCorrelationMatrix({ ...input, correlations })
}

/** @deprecated Use recommendedPairsForInput */
export function pairsForFluid(input: SimulationInput): ReturnType<typeof recommendedPairsForInput> {
  return recommendedPairsForInput(input)
}

export function cellHeatColor(rho: number): string {
  if (rho >= 0) {
    const t = Math.min(1, rho)
    const g = Math.round(180 + 75 * t)
    return `rgb(230, ${g}, 230)`
  }
  const t = Math.min(1, -rho)
  const r = Math.round(180 + 75 * t)
  return `rgb(${r}, 220, 240)`
}
