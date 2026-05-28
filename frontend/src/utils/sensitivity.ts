import { ARRAY_LABELS } from '../constants/chartVariables'
import type { SimulationArrays } from '../types/api'

/** Sampled inputs only (exclude derived volumetric / resource outputs). */
export const TORNADO_DRIVER_KEYS = [
  'area',
  'percent_fill',
  'net_pay_ft',
  'geometric_correction',
  'grv_acft',
  'grv_percent_fill',
  'net_to_gross',
  'porosity',
  'saturation',
  'oil_recovery',
  'fvf',
  'gor',
  'solution_gas_recovery',
  'gas_recovery',
  'gef',
  'condensate_yield',
] as const

export interface TornadoDriver {
  key: string
  label: string
  rho: number
  absRho: number
  /** True when all MC samples are identical (fixed input) — no Spearman sensitivity. */
  isFixed: boolean
}

function arrayIsConstant(values: number[]): boolean {
  if (values.length < 2) return true
  const first = values[0]
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== first && Math.abs(values[i] - first) > 1e-12 * Math.max(1, Math.abs(first))) {
      return false
    }
  }
  return true
}

function rankValues(values: number[]): number[] {
  const n = values.length
  const indexed = values.map((v, i) => ({ v, i }))
  indexed.sort((a, b) => a.v - b.v)
  const ranks = new Array<number>(n)
  let i = 0
  while (i < n) {
    let j = i
    while (j + 1 < n && indexed[j + 1].v === indexed[i].v) j += 1
    const avgRank = (i + j + 2) / 2
    for (let k = i; k <= j; k++) ranks[indexed[k].i] = avgRank
    i = j + 1
  }
  return ranks
}

/** Spearman rank correlation (matches engine rank-copula interpretation). */
export function spearmanRho(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 3) return 0

  const xs = x.slice(0, n)
  const ys = y.slice(0, n)
  const rx = rankValues(xs)
  const ry = rankValues(ys)

  const meanRx = rx.reduce((a, b) => a + b, 0) / n
  const meanRy = ry.reduce((a, b) => a + b, 0) / n

  let num = 0
  let denX = 0
  let denY = 0
  for (let i = 0; i < n; i++) {
    const dx = rx[i] - meanRx
    const dy = ry[i] - meanRy
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  const den = Math.sqrt(denX * denY)
  if (den < 1e-15) return 0
  return num / den
}

export function primaryResourceTargetKey(arrays: SimulationArrays): string | null {
  if ((arrays.total_mmboe?.length ?? 0) > 0) return 'total_mmboe'
  if ((arrays.recoverable_oil_mmbbl?.length ?? 0) > 0) return 'recoverable_oil_mmbbl'
  if ((arrays.recoverable_gas_bcf?.length ?? 0) > 0) return 'recoverable_gas_bcf'
  if ((arrays.stoiip_mmbbl?.length ?? 0) > 0) return 'stoiip_mmbbl'
  return null
}

export function tornadoDriverKeys(arrays: SimulationArrays): string[] {
  return TORNADO_DRIVER_KEYS.filter((k) => (arrays[k]?.length ?? 0) >= 10)
}

export function computeTornadoDrivers(
  arrays: SimulationArrays,
  targetKey: string,
): TornadoDriver[] {
  const target = arrays[targetKey]
  if (!target?.length) return []

  const drivers: TornadoDriver[] = []
  for (const key of tornadoDriverKeys(arrays)) {
    const sample = arrays[key]
    if (!sample?.length) continue
    const fixed = arrayIsConstant(sample)
    const rho = fixed ? 0 : spearmanRho(sample, target)
    if (!fixed && !Number.isFinite(rho)) continue
    drivers.push({
      key,
      label: ARRAY_LABELS[key] ?? key,
      rho,
      absRho: fixed ? 0 : Math.abs(rho),
      isFixed: fixed,
    })
  }

  return drivers.sort((a, b) => {
    if (a.isFixed !== b.isFixed) return a.isFixed ? 1 : -1
    return b.absRho - a.absRho
  })
}
