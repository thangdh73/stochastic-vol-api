import { useEffect, useMemo, useState } from 'react'
import type { ReservoirItem, ReservoirSegment, SimulateResponse } from '../types/api'
import {
  buildChartScopeOptions,
  defaultChartScopeSelection,
  resolveChartScope,
  type ChartScopeSelection,
  type ResolvedChartScope,
} from '../utils/chartScope'

export function useChartScope(
  simulation: SimulateResponse | null | undefined,
  segments: ReservoirSegment[],
  reservoirs: ReservoirItem[],
) {
  const options = useMemo(
    () => buildChartScopeOptions(simulation, segments, reservoirs),
    [simulation, segments, reservoirs],
  )

  const simulationKey = simulation?.input_hash ?? ''

  const [selection, setSelection] = useState<ChartScopeSelection>(() =>
    defaultChartScopeSelection(simulation, segments, reservoirs),
  )

  useEffect(() => {
    setSelection(defaultChartScopeSelection(simulation, segments, reservoirs))
  }, [simulationKey, simulation, segments, reservoirs])

  const resolved: ResolvedChartScope | null = useMemo(
    () => resolveChartScope(simulation, selection, segments, reservoirs),
    [simulation, selection, segments, reservoirs],
  )

  return { options, selection, setSelection, resolved }
}
