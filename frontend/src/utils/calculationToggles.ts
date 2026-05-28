import type { SimulationInput } from '../types/api'
import { defaultCcopRisk } from '../constants/ccopChance'
import { emptyDistribution } from './defaultInput'
import { correlatableVariables, pruneCorrelationsForMethod, syncCorrelationMatrix } from './correlations'

export function isOilCase(input: SimulationInput): boolean {
  return (input.fluid_type ?? 'oil').toLowerCase() === 'oil'
}

/** Effective flag: explicit false, explicit true, or inferred from distributions. */
export function includeSolutionGas(input: SimulationInput): boolean {
  if (!isOilCase(input)) return false
  if (input.include_solution_gas === false) return false
  if (input.include_solution_gas === true) return true
  return Boolean(input.gor_dist ?? input.solution_gas_recovery_dist)
}

export function applyOilRecovery(input: SimulationInput): boolean {
  if (!isOilCase(input)) return false
  if (input.apply_oil_recovery === false) return false
  if (input.apply_oil_recovery === true) return true
  return input.oil_recovery_dist != null
}

export function isCcopRiskModel(input: SimulationInput): boolean {
  return (input.risk_model ?? 'ccop_v1') === 'ccop_v1'
}

export function usesCcopRisk(input: SimulationInput): boolean {
  return isCcopRiskModel(input) && Boolean(input.ccop_risk)
}

export function includeChance(input: SimulationInput): boolean {
  if (input.include_chance === false) return false
  if (input.include_chance === true) return true
  if (isCcopRiskModel(input)) return true
  if (usesCcopRisk(input)) return true
  return Object.keys(input.chance_categories ?? {}).length > 0
}

/** Align toggle booleans with cleared distributions (e.g. after loading old saves). */
export function normalizeCalculationToggles(input: SimulationInput): SimulationInput {
  let next = { ...input }
  if (isOilCase(next)) {
    if (!applyOilRecovery(next)) {
      next = { ...next, apply_oil_recovery: false }
    }
    if (!includeSolutionGas(next)) {
      next = { ...next, include_solution_gas: false }
    }
  }
  if (!includeChance(next)) {
    next = { ...next, include_chance: false }
  }
  return next
}

/** Remove correlation pairs referencing variables turned off by toggles. */
export function pruneCorrelationsForToggles(input: SimulationInput): SimulationInput {
  const active = new Set(correlatableVariables(input))
  const correlations = (input.correlations ?? []).filter(
    (p) => active.has(p.variable_a) && active.has(p.variable_b),
  )
  return syncCorrelationMatrix(pruneCorrelationsForMethod({ ...input, correlations }))
}

function defaultOilRecoveryDist() {
  return emptyDistribution('re_oil', 'Oil Recovery Efficiency', 'fraction', 'beta')
}

function defaultGorDist() {
  return emptyDistribution('gor', 'GOR', 'scf/stb', 'normal')
}

function defaultSolutionGasRecoveryDist() {
  return emptyDistribution('sgre', 'Solution Gas Recovery', 'fraction', 'fixed')
}

export function setIncludeSolutionGas(
  input: SimulationInput,
  enabled: boolean,
): SimulationInput {
  let next: SimulationInput = {
    ...input,
    include_solution_gas: enabled,
  }
  if (!enabled) {
    next = {
      ...next,
      gor_dist: null,
      solution_gas_recovery_dist: null,
    }
  } else {
    next = {
      ...next,
      gor_dist: next.gor_dist ?? defaultGorDist(),
      solution_gas_recovery_dist:
        next.solution_gas_recovery_dist ?? defaultSolutionGasRecoveryDist(),
    }
  }
  return pruneCorrelationsForToggles(next)
}

export function setApplyOilRecovery(
  input: SimulationInput,
  enabled: boolean,
): SimulationInput {
  let next: SimulationInput = {
    ...input,
    apply_oil_recovery: enabled,
  }
  if (!enabled) {
    next = { ...next, oil_recovery_dist: null }
  } else {
    next = {
      ...next,
      oil_recovery_dist: next.oil_recovery_dist ?? defaultOilRecoveryDist(),
    }
  }
  return pruneCorrelationsForToggles(next)
}

const DEFAULT_LEGACY_CHANCE: SimulationInput['chance_categories'] = {
  source: [0.7],
  timing_migration: [0.7],
  reservoir: [0.7],
  closure: [0.7],
  containment: [0.7],
}

export function setIncludeChance(
  input: SimulationInput,
  enabled: boolean,
): SimulationInput {
  if (!enabled) {
    return {
      ...input,
      include_chance: false,
      chance_categories: {},
      ccop_risk: null,
    }
  }
  if (usesCcopRisk(input)) {
    return {
      ...input,
      include_chance: true,
      chance_categories: {},
      ccop_risk: input.ccop_risk ?? defaultCcopRisk(),
    }
  }
  return {
    ...input,
    include_chance: true,
    ccop_risk: null,
    chance_categories:
      Object.keys(input.chance_categories ?? {}).length > 0
        ? input.chance_categories
        : DEFAULT_LEGACY_CHANCE,
  }
}
