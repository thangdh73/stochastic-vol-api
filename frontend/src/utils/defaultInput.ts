import { defaultCcopRisk } from '../constants/ccopChance'
import type {
  DistributionSpec,
  ReservoirItem,
  ReservoirSegment,
  SimulationInput,
} from '../types/api'

export function emptyDistribution(
  variableId: string,
  displayName: string,
  unit: string,
  type = 'fixed',
): DistributionSpec {
  return {
    variable_id: variableId,
    display_name: displayName,
    distribution_type: type,
    unit,
    canonical_unit: unit,
    fixed_value: type === 'fixed' ? 0 : null,
    p90: null,
    p50: null,
    p10: null,
    min_bound: null,
    max_bound: null,
    low_clip: null,
    high_clip: null,
    notes: '',
  }
}

/** Starter GRV / NRV distributions that pass engine validation (P90/P10 set). */
export function nrvStarterDistributions() {
  return {
    grv_dist: {
      ...emptyDistribution('grv', 'Gross Rock Volume', 'acre-ft', 'lognormal'),
      p90: 5_000,
      p50: 10_000,
      p10: 20_000,
    },
    grv_percent_fill_dist: {
      ...emptyDistribution('grv_pf', 'Percent Trap Fill', 'fraction', 'fixed'),
      fixed_value: 1.0,
    },
    net_to_gross_dist: {
      ...emptyDistribution('ntg', 'Net to Gross', 'fraction', 'lognormal'),
      p90: 0.55,
      p50: 0.75,
      p10: 0.92,
      min_bound: 0,
      max_bound: 1,
    },
    nrv_direct_dist: {
      ...emptyDistribution('nrv', 'Net Rock Volume', 'acre-ft', 'lognormal'),
      p90: 4_000,
      p50: 8_000,
      p10: 16_000,
    },
    cross_check_area_dist: {
      ...emptyDistribution('cc_area', 'Cross-check Productive Area', 'acres', 'lognormal'),
      p90: 2_000,
      p50: 5_000,
      p10: 12_000,
    },
    nrv_direct_multiplier_dist: {
      ...emptyDistribution('nrv_mult', 'NRV multiply factor', 'fraction', 'fixed'),
      fixed_value: 1.0,
    },
  }
}

function grvDistReady(dist: DistributionSpec | null | undefined): boolean {
  if (!dist) return false
  if (dist.distribution_type === 'fixed') {
    return dist.fixed_value != null && Number.isFinite(dist.fixed_value)
  }
  return dist.p90 != null && dist.p10 != null
}

/** Ensure NRV/GRV distributions exist and are valid enough for preview (e.g. after PM3X-D load). */
/** Starter condensate yield (bbl/MMscf) for gas-condensate cases. */
export function condensateYieldStarter(): DistributionSpec {
  return {
    ...emptyDistribution('cy', 'Condensate Yield', 'bbl/MMscf', 'lognormal'),
    p90: 25,
    p50: 50,
    p10: 90,
    min_bound: 0,
  }
}

/** Ensure gas-condensate cases have a non-zero condensate yield distribution. */
export function ensureGasCondensateFields(input: SimulationInput): SimulationInput {
  if (input.fluid_type !== 'gas_condensate') return input
  const cy = input.condensate_yield_dist
  if (!cy) {
    return { ...input, condensate_yield_dist: condensateYieldStarter() }
  }
  if (cy.distribution_type === 'fixed' && (cy.fixed_value == null || cy.fixed_value <= 0)) {
    return { ...input, condensate_yield_dist: condensateYieldStarter() }
  }
  return input
}

export function ensureNrvDistributions(input: SimulationInput): SimulationInput {
  const starters = nrvStarterDistributions()
  return {
    ...input,
    nrv_entry_mode: input.nrv_entry_mode ?? 'grv_fill_ntg',
    cross_check_enabled: input.cross_check_enabled ?? false,
    grv_ntg_correlation: input.grv_ntg_correlation ?? 0,
    grv_dist: grvDistReady(input.grv_dist) ? input.grv_dist! : starters.grv_dist,
    grv_percent_fill_dist: grvDistReady(input.grv_percent_fill_dist)
      ? input.grv_percent_fill_dist!
      : starters.grv_percent_fill_dist,
    net_to_gross_dist: grvDistReady(input.net_to_gross_dist)
      ? input.net_to_gross_dist!
      : starters.net_to_gross_dist,
    nrv_direct_dist: grvDistReady(input.nrv_direct_dist)
      ? input.nrv_direct_dist!
      : starters.nrv_direct_dist,
    cross_check_area_dist: input.cross_check_area_dist ?? starters.cross_check_area_dist,
    nrv_direct_multiplier_dist:
      input.nrv_direct_multiplier_dist ?? starters.nrv_direct_multiplier_dist,
  }
}

export function createDefaultInput(): SimulationInput {
  return {
    schema_version: '1',
    prospect_name: 'New Prospect',
    fluid_type: 'oil',
    zone_name: 'Zone 1',
    country: '',
    basin: '',
    formation: '',
    notes: '',
    n_iterations: 5000,
    seed: 42,
    gas_oil_ratio: 6,
    chance_categories: {},
    risk_model: 'ccop_v1',
    ccop_risk: defaultCcopRisk(),
    include_chance: true,
    correlation_mode: 'independent',
    correlations: [],
    complex_trap: {
      enabled: false,
      method: 'A',
      num_elements: 1,
      element_1: {
        enabled: true,
        max_area_acres: 2000,
        seal_confidence: 0.5,
      },
      element_2: {
        enabled: false,
        max_area_acres: 4000,
        seal_confidence: 0.8,
      },
    },
    area_dist: emptyDistribution('area', 'Closed Area', 'acres', 'lognormal'),
    percent_fill_dist: emptyDistribution('pf', 'Percent Fill', 'fraction', 'fixed'),
    net_pay_dist: emptyDistribution('net_pay', 'Net Pay', 'ft', 'lognormal'),
    geometric_correction_dist: emptyDistribution(
      'gcf',
      'Geometric Correction Factor',
      'fraction',
      'fixed',
    ),
    porosity_dist: emptyDistribution('phi', 'Porosity', 'fraction', 'beta'),
    saturation_dist: emptyDistribution('sat', 'HC Saturation', 'fraction', 'beta'),
    oil_recovery_dist: emptyDistribution(
      're_oil',
      'Oil Recovery Efficiency',
      'fraction',
      'beta',
    ),
    fvf_dist: emptyDistribution('fvf', 'Oil FVF', 'rb/stb', 'fixed'),
    gor_dist: emptyDistribution('gor', 'GOR', 'scf/stb', 'normal'),
    solution_gas_recovery_dist: emptyDistribution(
      'sgre',
      'Solution Gas Recovery',
      'fraction',
      'fixed',
    ),
    gas_recovery_dist: emptyDistribution('re_gas', 'Gas Recovery', 'fraction', 'beta'),
    gef_dist: emptyDistribution('gef', 'Gas Expansion Factor', 'scf/reservoir ft³', 'fixed'),
    condensate_yield_dist: null,
    estimating_method: 'area_net_pay_yield',
    nrv_entry_mode: 'grv_fill_ntg',
    cross_check_enabled: false,
    grv_ntg_correlation: 0,
    oil_resource_unit: 'MMBO',
    gas_resource_unit: 'BCF',
    total_resource_unit: 'MMBOE',
    area_input_unit: 'acres',
    grv_input_unit: 'acre_ft',
    nrv_input_unit: 'acre_ft',
    include_solution_gas: true,
    apply_oil_recovery: true,
    ...nrvStarterDistributions(),
  }
}

export function createDefaultSegment(index = 1): ReservoirSegment {
  return {
    id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: `Seg${index}`,
    type: 'fault_block',
    shared_ntg: false,
    shared_hc_yield: false,
    shared_correlation: false,
  }
}

export function createDefaultReservoir(index = 1): ReservoirItem {
  return {
    id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: `Reservoir${index}`,
    enabled: true,
    shared_simulation: false,
    shared_ntg: true,
    shared_hc_yield: true,
    shared_correlation: true,
  }
}
