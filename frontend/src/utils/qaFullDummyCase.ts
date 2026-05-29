/**
 * Full-application QA dummy: 3 segments × 2 reservoirs, PM3X-D–style inputs,
 * uncertainty groups, and group correlation matrix (rank mode).
 */
import { api } from '../api/client'
import { defaultCcopRisk } from '../constants/ccopChance'
import type { DistributionSpec, ReservoirItem, ReservoirSegment, SimulationInput } from '../types/api'
import type { TankProjectEnvelope } from './tankEnvelope'
import { setGroupMatrixCell, syncGroupCorrelationMatrix } from './groupCorrelations'
import { ensureNrvDistributions, nrvStarterDistributions } from './defaultInput'
import { tankId } from './tankLabels'
import type { UncertaintyParameterGroup } from '../types/uncertaintyGroups'

const QA_SEG_IDS = ['seg-qa-a', 'seg-qa-b', 'seg-qa-c'] as const
const QA_RES_IDS = ['res-qa-north', 'res-qa-south'] as const

function scaleLogTri(dist: DistributionSpec, factor: number): DistributionSpec {
  if (dist.distribution_type === 'fixed' && dist.fixed_value != null) {
    return { ...dist, fixed_value: dist.fixed_value * factor }
  }
  const scale = (v: number | null | undefined) =>
    v != null && Number.isFinite(v) ? v * factor : v
  return {
    ...dist,
    p90: scale(dist.p90) as number | null,
    p50: scale(dist.p50) as number | null,
    p10: scale(dist.p10) as number | null,
  }
}

function buildBaseFromPm3xd(pm3xd: SimulationInput): SimulationInput {
  const nrv = nrvStarterDistributions()
  return ensureNrvDistributions({
    ...pm3xd,
    prospect_name: 'QA Full Dummy',
    country: 'QA Country',
    basin: 'QA Basin',
    formation: 'QA Formation',
    notes:
      'Auto-generated QA dummy (3×2 tanks, groups, GRV/NRV method). Safe to delete or overwrite.',
    estimating_method: 'nrv_grv_yield',
    n_iterations: 3000,
    seed: 20260528,
    include_chance: true,
    risk_model: 'ccop_v1',
    ccop_risk: defaultCcopRisk(),
    chance_categories: {},
    correlation_mode: 'gaussian_copula',
    correlations: [
      {
        variable_a: 'porosity',
        variable_b: 'saturation',
        rho: -0.55,
        enabled: true,
        notes: 'QA per-tank pair',
      },
    ],
    complex_trap: {
      enabled: true,
      method: 'A',
      num_elements: 2,
      element_1: { enabled: true, max_area_acres: 1500, seal_confidence: 0.6 },
      element_2: { enabled: true, max_area_acres: 2800, seal_confidence: 0.75 },
    },
    cross_check_enabled: true,
    grv_ntg_correlation: -0.35,
    ...nrv,
  })
}

function buildSegments(): ReservoirSegment[] {
  return [
    {
      id: QA_SEG_IDS[0],
      name: 'Zone A',
      type: 'fault_block',
      shared_ntg: false,
      shared_hc_yield: false,
      shared_correlation: false,
    },
    {
      id: QA_SEG_IDS[1],
      name: 'Zone B',
      type: 'compartment',
      shared_ntg: false,
      shared_hc_yield: false,
      shared_correlation: false,
    },
    {
      id: QA_SEG_IDS[2],
      name: 'Zone C',
      type: 'geobody',
      shared_ntg: false,
      shared_hc_yield: false,
      shared_correlation: false,
    },
  ]
}

function buildReservoirs(): ReservoirItem[] {
  return [
    {
      id: QA_RES_IDS[0],
      name: 'North',
      enabled: true,
      shared_simulation: true,
      shared_ntg: true,
      shared_hc_yield: true,
      shared_correlation: true,
    },
    {
      id: QA_RES_IDS[1],
      name: 'South',
      enabled: true,
      shared_simulation: false,
      shared_ntg: false,
      shared_hc_yield: false,
      shared_correlation: false,
    },
  ]
}

function tankScale(segIndex: number, resIndex: number): number {
  return 0.88 + segIndex * 0.06 + resIndex * 0.1
}

function buildTankInput(
  base: SimulationInput,
  segment: ReservoirSegment,
  reservoir: ReservoirItem,
  segIndex: number,
  resIndex: number,
): SimulationInput {
  const factor = tankScale(segIndex, resIndex)
  const trap =
    segIndex === 0 && resIndex === 0
      ? base.complex_trap
      : { ...base.complex_trap!, enabled: false }
  return {
    ...base,
    zone_name: `${segment.name}, ${reservoir.name}`,
    area_dist: scaleLogTri(base.area_dist!, factor),
    net_pay_dist: scaleLogTri(base.net_pay_dist!, factor),
    porosity_dist: scaleLogTri(base.porosity_dist!, 0.95 + segIndex * 0.03),
    saturation_dist: scaleLogTri(base.saturation_dist!, 0.98 + resIndex * 0.02),
    grv_dist: scaleLogTri(base.grv_dist!, factor),
    net_to_gross_dist: scaleLogTri(base.net_to_gross_dist!, 1),
    nrv_direct_dist: scaleLogTri(base.nrv_direct_dist!, factor),
    complex_trap: trap,
  }
}

function buildExampleGroups(
  segments: ReservoirSegment[],
  reservoirs: ReservoirItem[],
): { groups: UncertaintyParameterGroup[]; matrix: ReturnType<typeof syncGroupCorrelationMatrix> } {
  const r1 = reservoirs[0]
  const s1 = segments[0]
  const s2 = segments[1]
  const s3 = segments[2]
  const groups: UncertaintyParameterGroup[] = [
    {
      id: 'qa_grv_all',
      name: 'GRV_all_Seg',
      parameter: 'grv',
      members: [],
      all_segments: true,
      all_reservoirs: true,
      notes: 'Prospect-wide GRV driver (QA)',
    },
    {
      id: 'qa_poro_s12',
      name: 'Poro_R1_S1,2',
      parameter: 'porosity',
      members: [
        { segment_id: s1.id, reservoir_id: r1.id },
        { segment_id: s2.id, reservoir_id: r1.id },
      ],
    },
    {
      id: 'qa_poro_s3',
      name: 'Poro_R1_S3',
      parameter: 'porosity',
      members: [{ segment_id: s3.id, reservoir_id: r1.id }],
      notes: 'Diagenesis compartment',
    },
    {
      id: 'qa_sw_s12',
      name: 'Sw_R1_S1,2',
      parameter: 'saturation',
      members: [
        { segment_id: s1.id, reservoir_id: r1.id },
        { segment_id: s2.id, reservoir_id: r1.id },
      ],
    },
    {
      id: 'qa_sw_s3',
      name: 'Sw_R1_S3',
      parameter: 'saturation',
      members: [{ segment_id: s3.id, reservoir_id: r1.id }],
    },
  ]
  let matrix = syncGroupCorrelationMatrix(null, groups)
  if (matrix) {
    matrix = setGroupMatrixCell(matrix, 'qa_poro_s12', 'qa_sw_s12', -0.8)
    matrix = setGroupMatrixCell(matrix, 'qa_poro_s3', 'qa_sw_s3', 0.7)
  }
  return { groups, matrix }
}

/** Build a multi-tank envelope for full QA (Dashboard → QA/QC). */
export async function buildQaFullDummyEnvelope(): Promise<TankProjectEnvelope> {
  const pm3xd = await api.getPm3xdCase()
  const base = buildBaseFromPm3xd(pm3xd)
  const segments = buildSegments()
  const reservoirs = buildReservoirs()
  const tank_inputs: Record<string, SimulationInput> = {}

  segments.forEach((seg, si) => {
    reservoirs.forEach((res, ri) => {
      tank_inputs[tankId(seg.id, res.id)] = buildTankInput(base, seg, res, si, ri)
    })
  })

  const { groups, matrix } = buildExampleGroups(segments, reservoirs)

  return {
    schema_version: '1',
    segments,
    reservoirs,
    tank_inputs,
    active_segment_id: segments[0].id,
    active_reservoir_id: reservoirs[0].id,
    uncertainty_groups: groups,
    group_correlation_matrix: matrix ?? undefined,
    group_correlation_mode: 'rank',
  }
}
