/** Simulation array keys → display labels (aligned with MMRA.xlsm Resources / Scatter). */

export const ARRAY_LABELS: Record<string, string> = {
  area: 'Closed area (acres)',
  percent_fill: 'Percent fill (fraction)',
  net_pay_ft: 'Net pay (ft)',
  geometric_correction: 'Geometric correction',
  productive_area: 'Productive area (acres)',
  grv_acft: 'GRV (acre-ft)',
  grv_percent_fill: 'Percent trap fill (fraction)',
  net_to_gross: 'Net/Gross (fraction)',
  nrv_acft: 'NRV (ac-ft)',
  porosity: 'Porosity (fraction)',
  saturation: 'HC saturation (fraction)',
  hcpv_acft: 'HCPV (ac-ft)',
  oil_recovery: 'Oil recovery (fraction)',
  fvf: 'Oil FVF (rb/stb)',
  gor: 'GOR (scf/stb)',
  solution_gas_recovery: 'Solution gas recovery',
  stoiip_mmbbl: 'STOIIP (MMbbl)',
  recoverable_oil_mmbbl: 'Recoverable oil (MMbbl)',
  solution_gas_bcf: 'Solution gas (Bcf)',
  total_mmboe: 'Total geologic (MMBOE)',
  giip_bcf: 'GIIP (Bcf)',
  recoverable_gas_bcf: 'Recoverable gas (Bcf)',
  condensate_mmbbl: 'Condensate (MMbbl)',
  gef: 'GEF',
  gas_recovery: 'Gas recovery (fraction)',
  condensate_yield: 'Condensate yield',
}

/** Primary resource outputs for histogram / exceedance (workbook Resources sheet). */
export const RESOURCE_ARRAY_KEYS = [
  'total_mmboe',
  'recoverable_oil_mmbbl',
  'stoiip_mmbbl',
  'solution_gas_bcf',
  'recoverable_gas_bcf',
  'giip_bcf',
  'condensate_mmbbl',
] as const

/** Volumetric chain inputs — QC distribution checks (Area, Net Pay, NRV, HC Yield). */
export const INPUT_QC_ARRAY_KEYS = [
  'area',
  'productive_area',
  'grv_acft',
  'grv_percent_fill',
  'net_to_gross',
  'net_pay_ft',
  'nrv_acft',
  'porosity',
  'saturation',
  'hcpv_acft',
  'oil_recovery',
  'fvf',
  'gor',
] as const

/** Workbook-style cross-plots (Scatter Chart sheet). */
export const RECOMMENDED_SCATTER_PAIRS: { x: string; y: string; label: string }[] = [
  { x: 'area', y: 'net_pay_ft', label: 'Area vs net pay' },
  { x: 'productive_area', y: 'nrv_acft', label: 'Productive area vs NRV' },
  { x: 'nrv_acft', y: 'hcpv_acft', label: 'NRV vs HCPV' },
  { x: 'porosity', y: 'saturation', label: 'Porosity vs saturation' },
  { x: 'recoverable_oil_mmbbl', y: 'total_mmboe', label: 'Recoverable oil vs total MMBOE' },
  { x: 'stoiip_mmbbl', y: 'recoverable_oil_mmbbl', label: 'STOIIP vs recoverable oil' },
]

export type ResourceArrayKey = (typeof RESOURCE_ARRAY_KEYS)[number]
