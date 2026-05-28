/** Match engine mmra_engine.constants (acres internal for area). */

export const KM2_TO_ACRES = 247.105381467
export const ACRES_TO_KM2 = 1 / KM2_TO_ACRES

export function acresToSqKm(acres: number): number {
  return acres * ACRES_TO_KM2
}

export function sqKmToAcres(sqKm: number): number {
  return sqKm * KM2_TO_ACRES
}

// Match engine mmra_engine.constants (metres internal conversion).
export const METRES_TO_FEET = 3.280839895
export const FEET_TO_METRES = 1 / METRES_TO_FEET

export function metresToFeet(m: number): number {
  return m * METRES_TO_FEET
}

export function feetToMetres(ft: number): number {
  return ft * FEET_TO_METRES
}

// Rock volume (canonical internal unit: acre-ft) — match engine/mmra_engine/constants.py
export const ACFT_TO_FT3 = 43_560
export const FT3_TO_ACFT = 1 / ACFT_TO_FT3
const M3_PER_FT3 = 0.3048 ** 3
export const ACFT_TO_M3 = ACFT_TO_FT3 * M3_PER_FT3
export const M3_TO_ACFT = 1 / ACFT_TO_M3
