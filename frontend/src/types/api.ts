import type { CcopRiskReviewRow, CcopRiskSpec } from '../constants/ccopChance'
import type {
  GroupCorrelationMatrix,
  GroupCorrelationMode,
  UncertaintyParameterGroup,
} from './uncertaintyGroups'

export interface DistributionSpec {
  variable_id: string
  display_name: string
  distribution_type: string
  unit?: string
  canonical_unit?: string
  p90?: number | null
  p50?: number | null
  p10?: number | null
  fixed_value?: number | null
  tri_min?: number | null
  tri_mode?: number | null
  tri_max?: number | null
  min_bound?: number | null
  max_bound?: number | null
  low_clip?: number | null
  high_clip?: number | null
  notes?: string
  /** When true, P50 is used in 3-point skew fit (normal / lognormal / beta). */
  skew_enabled?: boolean
}

export interface CorrelationPair {
  variable_a: string
  variable_b: string
  rho: number
  enabled: boolean
  notes?: string
}

/** Symmetric ρ matrix; each off-diagonal links to one correlation pair. */
export interface CorrelationMatrix {
  variables: string[]
  values: number[][]
}

export interface ComplexTrapElement {
  enabled: boolean
  max_area_acres: number
  seal_confidence: number
  notes?: string
}

export interface ComplexTrapConfig {
  enabled: boolean
  method: 'A' | 'B'
  num_elements: number
  element_1: ComplexTrapElement
  element_2: ComplexTrapElement
}

export type EstimatingMethod = 'area_net_pay_yield' | 'nrv_grv_yield'
export type NrvEntryMode = 'grv_fill_ntg' | 'direct' | 'petrel_marginals'

/** Petrel: 3 structural GRV (mid contact) + 3 contact GRV (mid structure), P90/P50/P10 order. */
export interface PetrelGrvMarginals {
  depth_grv: [number, number, number]
  contact_grv: [number, number, number]
  depth_weights?: [number, number, number]
  contact_weights?: [number, number, number]
  grv_matrix_3x3?: number[][]
}
export type OilResourceUnit = 'MMBO' | 'MMSTB' | 'MMscm'
export type GasResourceUnit = 'BCF' | 'MMSCF' | 'Bscm'
export type TotalResourceUnit = 'MMBOE'

export type RiskModel = 'legacy' | 'ccop_v1'
export type AreaInputUnit = 'acres' | 'sq_km'
export type RockVolumeInputUnit =
  | 'acre_ft'
  | 'thousand_acre_ft'
  | 'ft3'
  | 'm3'
  | 'thousand_ft3'
  | 'thousand_m3'
  | 'million_ft3'
  | 'million_m3'

export interface SimulationInput {
  schema_version: '1'
  prospect_name: string
  fluid_type: string
  zone_name: string
  country?: string
  basin?: string
  formation?: string
  notes?: string
  n_iterations: number
  seed: number
  gas_oil_ratio: number
  chance_categories: Record<string, number[]>
  /** legacy = 5-category weak-link; ccop_v1 = CCOP 2000 four-factor model */
  risk_model?: RiskModel
  ccop_risk?: CcopRiskSpec | null
  correlation_mode?: 'independent' | 'rank' | 'gaussian_copula'
  correlations?: CorrelationPair[]
  correlation_matrix?: CorrelationMatrix
  complex_trap?: ComplexTrapConfig
  estimating_method?: EstimatingMethod
  nrv_entry_mode?: NrvEntryMode
  petrel_grv_marginals?: PetrelGrvMarginals | null
  /** Per-iteration multiplier on direct NRV (fixed 1 = no change). */
  nrv_direct_multiplier_dist?: DistributionSpec | null
  cross_check_enabled?: boolean
  grv_ntg_correlation?: number
  oil_resource_unit?: OilResourceUnit
  gas_resource_unit?: GasResourceUnit
  total_resource_unit?: TotalResourceUnit
  area_input_unit?: AreaInputUnit
  grv_input_unit?: RockVolumeInputUnit
  nrv_input_unit?: RockVolumeInputUnit
  include_solution_gas?: boolean
  apply_oil_recovery?: boolean
  include_chance?: boolean
  area_dist?: DistributionSpec | null
  percent_fill_dist?: DistributionSpec | null
  net_pay_dist?: DistributionSpec | null
  geometric_correction_dist?: DistributionSpec | null
  porosity_dist?: DistributionSpec | null
  saturation_dist?: DistributionSpec | null
  oil_recovery_dist?: DistributionSpec | null
  fvf_dist?: DistributionSpec | null
  gor_dist?: DistributionSpec | null
  solution_gas_recovery_dist?: DistributionSpec | null
  gas_recovery_dist?: DistributionSpec | null
  gef_dist?: DistributionSpec | null
  condensate_yield_dist?: DistributionSpec | null
  grv_dist?: DistributionSpec | null
  grv_percent_fill_dist?: DistributionSpec | null
  net_to_gross_dist?: DistributionSpec | null
  nrv_direct_dist?: DistributionSpec | null
  cross_check_area_dist?: DistributionSpec | null
  pet_evaluation_dist?: DistributionSpec | null
}

export type ReservoirSegmentType =
  | 'fault_block'
  | 'geobody'
  | 'compartment'
  | 'other'

export interface ReservoirSegment {
  id: string
  name: string
  type: ReservoirSegmentType
  /** When true, NTG edits on any reservoir in this segment apply to all its tanks. */
  shared_ntg?: boolean
  /** When true, HC yield edits on any reservoir in this segment apply to all its tanks. */
  shared_hc_yield?: boolean
  /** When true, correlation edits on any reservoir in this segment apply to all its tanks. */
  shared_correlation?: boolean
}

export interface ReservoirItem {
  id: string
  name: string
  enabled: boolean
  shared_simulation: boolean
  /** When true, NTG (and GRV–NTG ρ) edits on any segment in this reservoir apply to all its tanks. */
  shared_ntg?: boolean
  /** When true, HC yield edits on any segment in this reservoir apply to all its tanks. */
  shared_hc_yield?: boolean
  /** When true, correlation edits on any segment in this reservoir apply to all its tanks. */
  shared_correlation?: boolean
}

export interface PercentileSummary {
  product_name: string
  unit: string
  p99: number
  p90: number
  p50: number
  mean_trimmed: number
  p10: number
  p01: number
}

export interface PgResult {
  pg: number
  category_chances: Record<string, number>
  unrisked_trimmed_mean: number
  pg_risked_mean: number
  resource_unit: string
  /** CCOP per-element rationale + P (when risk_model = ccop_v1). */
  risk_review?: CcopRiskReviewRow[]
}

export interface ValidationIssue {
  code: string
  severity: 'ERROR' | 'WARNING' | 'INFO'
  module: string
  field: string
  message: string
  recommended_action?: string | null
}

export interface ValidationReport {
  schema_version: string
  has_errors: boolean
  can_run_simulation: boolean
  issues: ValidationIssue[]
  input_hash: string
}

/** Monte Carlo sample vectors (when include_arrays=true). */
export type SimulationArrays = Record<string, number[]>

export interface SimulationResultPayload {
  prospect_name: string
  fluid_type: string
  seed: number
  n_iterations: number
  percentile_convention: string
  correlation_mode?: string
  complex_trap_method?: string
  complex_trap_scenario_counts?: Record<string, number>
  stoiip?: PercentileSummary | null
  recoverable_oil?: PercentileSummary | null
  solution_gas?: PercentileSummary | null
  giip?: PercentileSummary | null
  recoverable_gas?: PercentileSummary | null
  condensate?: PercentileSummary | null
  total_mmboe?: PercentileSummary | null
  pg_result?: PgResult | null
  arrays?: SimulationArrays
  solution_gas_included?: boolean
  oil_recovery_applied?: boolean
  chance_applied?: boolean
  volume_basis?: string
}

export interface ScopeBreakdownRow {
  id: string
  label: string
  segment_id?: string
  reservoir_id?: string
  summaries: Record<string, PercentileSummary>
  /** Per-scope MC sample vectors when simulation ran with include_arrays. */
  arrays?: SimulationArrays
}

export interface SimulateMultiTankMeta {
  enabled: boolean
  tank_count?: number
  group_oat?: boolean
}

export interface SimulationBreakdown {
  prospect: ScopeBreakdownRow
  reservoirs: ScopeBreakdownRow[]
  segments: ScopeBreakdownRow[]
  tanks: ScopeBreakdownRow[]
}

export interface SimulateResponse {
  schema_version: string
  engine_version: string
  input_hash: string
  input_hash_engine: string
  validation: ValidationReport
  result: SimulationResultPayload
  group_driver_map?: Record<string, { group_id: string; group_name: string }>
  breakdown?: SimulationBreakdown
  multi_tank?: SimulateMultiTankMeta
}

export interface GroupDependencyContextPayload {
  active_segment_id: string
  active_reservoir_id: string
  segment_ids: string[]
  reservoir_ids: string[]
  uncertainty_groups: UncertaintyParameterGroup[]
  group_correlation_mode: GroupCorrelationMode
  group_correlation_matrix: GroupCorrelationMatrix | null
  tank_inputs?: Record<string, SimulationInput>
}

export interface Prospect {
  id: number
  name: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  input_set_count?: number
  simulation_run_count?: number
}

/** Saved workflow inputs (engine schema v1 JSON). */
export interface InputSet {
  id: number
  prospect_id: number
  input_hash: string
  input: SimulationInput
  created_at: string
}

export interface HealthResponse {
  status: string
  engine_version: string
  schema_version: string
  /** Present on MMRA API ≥ module-preview build; used to detect stale backends. */
  api_features?: string[]
}

/** Workflow tab scopes for scoped module preview (not full-case MC). */
export type ModuleScope = 'area' | 'net_pay' | 'hc_yield' | 'chance' | 'nrv'

export interface PerturbationTornadoDriver {
  driver_id: string
  label: string
  delta_low: number
  delta_high: number
  swing_low: number
  swing_high: number
  is_fixed: boolean
}

export interface PerturbationTornadoResult {
  target_key: string
  target_label: string
  target_unit: string
  base_value: number
  method_note: string
  scope_type?: 'prospect' | 'reservoir' | 'segment' | 'tank'
  scope_id?: string | null
  drivers: PerturbationTornadoDriver[]
}

export interface PerturbationTornadoResponse {
  schema_version: string
  engine_version: string
  input_hash: string
  validation: ValidationReport
  tornado: PerturbationTornadoResult
  multi_tank?: { enabled?: boolean; group_oat?: boolean }
  debug_context?: { groups?: number; tank_inputs?: number }
}

export interface ModulePreviewResponse {
  scope: ModuleScope
  scope_label: string
  schema_version: string
  engine_version: string
  prospect_name: string
  n_iterations: number
  seed: number
  input_hash: string
  validation: ValidationReport
  arrays: SimulationArrays
  summaries: Record<string, PercentileSummary | Record<string, unknown>>
  metadata: Record<string, unknown>
}

export interface DistributionPreviewResponse {
  schema_version: string
  engine_version: string
  variable_id: string
  display_name: string
  distribution_type: string
  skew_enabled: boolean
  unit: string
  n_iterations: number
  seed: number
  samples: number[]
  summary: PercentileSummary
  input_markers: { p90?: number | null; p50?: number | null; p10?: number | null }
  validation: ValidationReport
}
