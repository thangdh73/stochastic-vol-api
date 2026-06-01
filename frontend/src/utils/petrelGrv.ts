import type { PetrelGrvMarginals, RockVolumeInputUnit, SimulationInput } from '../types/api'

export const PETREL_CASE_LABELS = ['P90 (low)', 'P50 (mid)', 'P10 (high)'] as const

/**
 * Three percentile case column headers for the Petrel 3+3 GRV matrix.
 *
 * These are the low/mid/high cases of EACH GRV axis (depth and fluid contact),
 * not the Setup GRV-uncertainty source names. Stored vectors are ordered
 * [low, mid, high] = [P90, P50, P10].
 */
export function petrelCaseLabels(): [string, string, string] {
  return ['P90', 'P50', 'P10']
}

/** Row label for the structural (depth) GRV axis in Petrel 3+3 (from Setup GRV uncertainties). */
export function petrelDepthRowLabel(grvParamLabels: string[]): string {
  return grvParamLabels[0]?.trim() || 'Structure (depth)'
}

/** Row label for the fluid-contact GRV axis in Petrel 3+3 (from Setup GRV uncertainties). */
export function petrelContactRowLabel(grvParamLabels: string[]): string {
  return grvParamLabels[2]?.trim() || grvParamLabels[1]?.trim() || 'Fluid contact'
}

export function defaultPetrelGrvMarginals(
  depthMid = 10_000,
  contactMid = 10_000,
): PetrelGrvMarginals {
  return {
    depth_grv: [depthMid * 0.8, depthMid, depthMid * 1.2],
    contact_grv: [contactMid * 0.9, contactMid, contactMid * 1.1],
    depth_weights: [1 / 3, 1 / 3, 1 / 3],
    contact_weights: [1 / 3, 1 / 3, 1 / 3],
  }
}

/** Build 3×3 GRV matrix from Petrel marginals (multiplicative combination). */
export function buildPetrelGrvMatrix(pm: PetrelGrvMarginals): number[][] {
  const [d90, d50, d10] = pm.depth_grv
  const [c90, c50, c10] = pm.contact_grv
  if (d50 <= 0 || c50 <= 0) throw new Error('P50 GRV values must be positive.')
  return [
    [d90 * c90 / c50, d90 * c50 / c50, d90 * c10 / c50],
    [d50 * c90 / c50, d50, d50 * c10 / c50],
    [d10 * c90 / c50, d10 * c50 / c50, d10 * c10 / c50],
  ]
}

export function ensurePetrelGrvMarginals(input: SimulationInput): SimulationInput {
  if (input.petrel_grv_marginals) return input
  return {
    ...input,
    nrv_entry_mode: 'petrel_marginals',
    petrel_grv_marginals: defaultPetrelGrvMarginals(),
  }
}

export function patchPetrelMarginals(
  input: SimulationInput,
  patch: Partial<PetrelGrvMarginals>,
): SimulationInput {
  const current = input.petrel_grv_marginals ?? defaultPetrelGrvMarginals()
  return {
    ...input,
    petrel_grv_marginals: { ...current, ...patch },
  }
}

export function updatePetrelCaseValue(
  pm: PetrelGrvMarginals,
  axis: 'depth' | 'contact',
  caseIndex: number,
  value: number,
): PetrelGrvMarginals {
  const key = axis === 'depth' ? 'depth_grv' : 'contact_grv'
  const next = [...pm[key]] as [number, number, number]
  next[caseIndex] = value
  return { ...pm, [key]: next }
}

export function petrelMatrixSummary(pm: PetrelGrvMarginals, unit: RockVolumeInputUnit): string {
  try {
    const m = buildPetrelGrvMatrix(pm)
    return `Derived 3×3 GRV (${unit}), mid cell = ${m[1][1].toLocaleString()}`
  } catch {
    return 'Check Petrel GRV values.'
  }
}
