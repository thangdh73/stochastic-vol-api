import type { AreaChartUnit } from '../components/charts/AreaWorkbookCharts'
import type { AreaInputUnit } from '../constants/inputUnits'
import type { SimulationInput } from '../types/api'

export function areaChartUnitFromInput(
  input: SimulationInput | null | undefined,
): AreaChartUnit {
  return input?.area_input_unit === 'sq_km' ? 'sq_km' : 'acres'
}

export function normalizeAreaInputUnit(unit: AreaInputUnit | undefined): AreaInputUnit {
  return unit === 'sq_km' ? 'sq_km' : 'acres'
}
