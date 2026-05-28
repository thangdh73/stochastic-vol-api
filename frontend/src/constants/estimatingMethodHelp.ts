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
      'Net rock volume is built from gross rock volume (GRV, acre-ft), percent trap fill, and net-to-gross, ' +
      'or entered directly as an NRV distribution. The same HC yield chain (porosity, saturation, recovery) ' +
      'is applied as in the Area × Net Pay method. Optional area–net pay cross-check compares implied net pay ' +
      'from NRV ÷ productive area against geologic expectations.',
    diagramSrc: '/help/estimating-method-nrv-grv.png',
  },
]

export function slideForEstimatingKey(
  key: EstimatingMethodHelpKey,
): EstimatingMethodHelpSlide {
  return ESTIMATING_METHOD_HELP.find((s) => s.key === key) ?? ESTIMATING_METHOD_HELP[0]
}
