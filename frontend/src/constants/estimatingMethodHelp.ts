export type EstimatingMethodHelpKey = 'area_net_pay_yield' | 'nrv_grv_yield'

export interface EstimatingMethodHelpSlide {
  key: EstimatingMethodHelpKey
  title: string
  short: string
  explain: string
  /** Optional diagram under frontend/public/help/ */
  diagramSrc?: string
}

export const ESTIMATING_METHOD_HELP: EstimatingMethodHelpSlide[] = [
  {
    key: 'area_net_pay_yield',
    title: 'Area × Net Pay × HC Yield',
    short:
      'Multiply Area × Net Pay × HC Yield distributions. Most commonly used estimating method.',
    explain:
      'Productive area (closed area × percent fill, with optional geometric correction and complex traps) ' +
      'is multiplied by net pay thickness and geometric correction factor to obtain net rock volume (NRV). ' +
      'HC yield (porosity, saturation, recovery, FVF/GEF) is applied to NRV to estimate in-place and recoverable resources.',
    diagramSrc: '/help/estimating-method-area-net-pay.png',
  },
  {
    key: 'nrv_grv_yield',
    title: 'Net Rock Volume × HC Yield',
    short:
      'Multiply Net Rock Volume × HC Yield distributions. Often used when NRV or GRV is available from a workstation interpretation.',
    explain:
      'Rock volume has two modes. (1) Decomposed: gross rock volume (GRV) × percent trap fill × net-to-gross ' +
      '(NTG), each with its own uncertainty — combined automatically each Monte Carlo iteration into net rock ' +
      'volume (NRV). Use Petrel GRV (3+3) when Petrel gives three structural GRVs and three contact GRVs; ' +
      'the app builds a depth×contact matrix and tornado shows separate Depth and Fluid contact bars. ' +
      'Alternatively use GRV × fill × NTG with manual distributions on Input → Rock volume. ' +
      '(2) Direct NRV: check NTG constant on Setup when NRV (acre-ft) is already calculated outside the app ' +
      '(e.g. workstation GRV × fill × NTG); enter one NRV distribution only. HC yield (porosity, saturation, ' +
      'recovery, FVF/GEF) is applied to NRV the same way in both modes.',
    diagramSrc: '/help/estimating-method-nrv-grv.png',
  },
]

export function slideForEstimatingKey(
  key: EstimatingMethodHelpKey,
): EstimatingMethodHelpSlide {
  return ESTIMATING_METHOD_HELP.find((s) => s.key === key) ?? ESTIMATING_METHOD_HELP[0]
}
