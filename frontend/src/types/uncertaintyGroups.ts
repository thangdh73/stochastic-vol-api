/** Prospect-level uncertainty driver (tornado / MC dependency unit). */
export type UncertaintyParameterId =
  | 'grv'
  | 'petrel_grv_depth'
  | 'petrel_grv_contact'
  | 'grv_percent_fill'
  | 'net_to_gross'
  | 'area'
  | 'percent_fill'
  | 'net_pay'
  | 'geometric_correction'
  | 'porosity'
  | 'saturation'
  | 'oil_recovery'
  | 'fvf'
  | 'gor'
  | 'solution_gas_recovery'
  | 'gas_recovery'
  | 'gef'
  | 'condensate_yield'
  | 'nrv_direct'

export interface UncertaintyGroupMember {
  segment_id: string
  reservoir_id: string
}

export interface UncertaintyParameterGroup {
  id: string
  name: string
  parameter: UncertaintyParameterId
  /** Explicit tank keys; ignored when all_segments / all_reservoirs expand membership. */
  members: UncertaintyGroupMember[]
  all_segments?: boolean
  all_reservoirs?: boolean
  notes?: string
}

export interface GroupCorrelationMatrix {
  group_ids: string[]
  values: number[][]
}

export type GroupCorrelationMode = 'independent' | 'rank' | 'gaussian_copula'
