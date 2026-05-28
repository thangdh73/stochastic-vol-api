import type { ComplexTrapConfig, DistributionSpec, SimulationInput } from '../types/api'

/** Suggest downdip element caps from GRV percentiles (canonical acre-ft). */
export function suggestComplexTrapCapsFromGrv(
  grv: DistributionSpec | null | undefined,
): Pick<ComplexTrapConfig, 'element_1' | 'element_2'> | null {
  if (!grv) return null
  const p90 = grv.p90 ?? grv.fixed_value
  const p50 = grv.p50
  const p10 = grv.p10
  if (p90 == null || p90 <= 0) return null
  const el1 = Math.max(p90, 1)
  const el2 =
    p10 != null && p10 > el1
      ? p10
      : p50 != null && p50 > el1
        ? p50
        : el1 * 1.5
  return {
    element_1: {
      enabled: true,
      max_area_acres: el1,
      seal_confidence: 0.5,
      notes: '',
    },
    element_2: {
      enabled: true,
      max_area_acres: el2,
      seal_confidence: 0.65,
      notes: '',
    },
  }
}

export function withNrvComplexTrapEnabled(
  input: SimulationInput,
  enabled: boolean,
): SimulationInput {
  const ct = input.complex_trap ?? {
    enabled: false,
    method: 'A' as const,
    num_elements: 1,
    element_1: { enabled: true, max_area_acres: 0, seal_confidence: 0.5 },
    element_2: { enabled: false, max_area_acres: 0, seal_confidence: 0.8 },
  }
  if (!enabled) {
    return { ...input, complex_trap: { ...ct, enabled: false } }
  }
  const suggested = suggestComplexTrapCapsFromGrv(input.grv_dist)
  const element_1 = suggested?.element_1 ?? ct.element_1
  const element_2 = suggested?.element_2 ?? ct.element_2
  const needsCap =
    !element_1.max_area_acres ||
    element_1.max_area_acres <= 0 ||
    (ct.num_elements >= 2 && (!element_2.max_area_acres || element_2.max_area_acres <= element_1.max_area_acres))
  return {
    ...input,
    complex_trap: {
      ...ct,
      enabled: true,
      method: 'A',
      element_1: needsCap && suggested ? suggested.element_1 : { ...element_1, enabled: true },
      element_2:
        ct.num_elements >= 2
          ? {
              ...(needsCap && suggested ? suggested.element_2 : element_2),
              enabled: true,
            }
          : { ...element_2, enabled: false },
    },
  }
}

export function complexTrapStatusMessage(
  input: SimulationInput,
  metadata?: Record<string, unknown>,
): string | null {
  const ct = input.complex_trap
  if (!ct?.enabled) {
    return 'Complex trap is off — enable it under Advanced, then run NRV simulation again.'
  }
  if (input.cross_check_enabled) {
    return 'Complex trap is disabled while area–net pay cross-check is on (matches reference workbook).'
  }
  const method = metadata?.complex_trap_method as string | undefined
  const counts = metadata?.complex_trap_scenario_counts as Record<string, number> | undefined
  if (!method) {
    return 'Complex trap is enabled in inputs — run NRV simulation to apply it to results.'
  }
  if (counts) {
    const parts = Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([label, n]) => `${label}: ${n.toLocaleString()}`)
    return `Complex trap applied (${method.replace(/_/g, ' ')}). ${parts.join(' · ')}`
  }
  return `Complex trap applied (${method.replace(/_/g, ' ')}).`
}
