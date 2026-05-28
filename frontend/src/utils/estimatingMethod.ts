import type { EstimatingMethod, SimulationInput } from '../types/api'

export function effectiveEstimatingMethod(input: SimulationInput): EstimatingMethod {
  return input.estimating_method === 'nrv_grv_yield' ? 'nrv_grv_yield' : 'area_net_pay_yield'
}

export const ESTIMATING_METHOD_LABELS: Record<EstimatingMethod, string> = {
  area_net_pay_yield: 'Volumetric: Area × Net Pay × HC Yield',
  nrv_grv_yield: 'Volumetric: Net Rock Volume × HC Yield',
}

export const ESTIMATING_METHOD_SHORT: Record<EstimatingMethod, string> = {
  area_net_pay_yield: 'Volumetric Area × Net Pay',
  nrv_grv_yield: 'Volumetric NRV × HC Yield',
}

/** Previous workflow step before HC Yield (Net Pay vs NRV / GRV). */
export function volumetricStepBeforeHcYield(input: SimulationInput): {
  to: string
  label: string
} {
  if (effectiveEstimatingMethod(input) === 'nrv_grv_yield') {
    return { to: '/nrv', label: 'NRV / GRV' }
  }
  return { to: '/net-pay', label: 'Net Pay' }
}
