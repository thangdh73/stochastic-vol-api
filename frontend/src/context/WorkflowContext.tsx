import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { normalizeCalculationToggles } from '../utils/calculationToggles'
import { ensureCcopRiskInInput } from '../utils/ensureCcopRiskInInput'
import { createDefaultInput, createDefaultReservoir, createDefaultSegment } from '../utils/defaultInput'
import { readActiveProject, writeActiveProject } from '../utils/projectSession'
import type { TankProjectEnvelope } from '../utils/tankEnvelope'
import {
  applySharedCorrelationToLinkedTanks,
  mergeSharedCorrelationFields,
} from '../utils/tankCorrelationShared'
import { applySharedHcYieldToLinkedTanks, mergeSharedHcYieldFields } from '../utils/tankHcYieldShared'
import { applySharedNtgToLinkedTanks, mergeSharedNtgFields } from '../utils/tankNrvShared'
import { syncGroupCorrelationMatrix, setGroupMatrixCell } from '../utils/groupCorrelations'
import { tankId } from '../utils/tankLabels'
import type {
  GroupDependencyContextPayload,
  ModulePreviewResponse,
  ModuleScope,
  ReservoirItem,
  ReservoirSegment,
  ReservoirSegmentType,
  SimulateResponse,
  SimulationInput,
  ValidationReport,
} from '../types/api'
import type {
  GroupCorrelationMatrix,
  GroupCorrelationMode,
  UncertaintyParameterGroup,
} from '../types/uncertaintyGroups'

interface WorkflowState {
  reservoirs: ReservoirItem[]
  segments: ReservoirSegment[]
  activeReservoirId: string | null
  activeSegmentId: string | null
  input: SimulationInput | null
  validation: ValidationReport | null
  simulation: SimulateResponse | null
  modulePreviews: Partial<Record<ModuleScope, ModulePreviewResponse>>
  activeProjectId: number | null
  activeProjectName: string | null
  loading: boolean
  error: string | null
  setInput: (input: SimulationInput | null) => void
  getTankInput: (segmentId: string, reservoirId: string) => SimulationInput | null
  setActiveTank: (segmentId: string, reservoirId: string) => void
  getEnvelopeForSave: () => TankProjectEnvelope | null
  loadFromEnvelope: (envelope: TankProjectEnvelope) => void
  setSegmentsFromInput: (input: SimulationInput | null) => void
  addReservoir: () => void
  renameReservoir: (reservoirId: string, name: string) => void
  toggleReservoir: (reservoirId: string) => void
  toggleReservoirSharedSimulation: (reservoirId: string) => void
  toggleReservoirSharedNtg: (reservoirId: string) => void
  toggleSegmentSharedNtg: (segmentId: string) => void
  toggleReservoirSharedHcYield: (reservoirId: string) => void
  toggleSegmentSharedHcYield: (segmentId: string) => void
  toggleReservoirSharedCorrelation: (reservoirId: string) => void
  toggleSegmentSharedCorrelation: (segmentId: string) => void
  copyNrvNtgFromActive: (scope: 'reservoir' | 'all') => void
  removeReservoir: (reservoirId: string) => void
  moveReservoir: (reservoirId: string, direction: 'up' | 'down') => void
  setActiveReservoir: (reservoirId: string) => void
  addSegment: (partial?: Partial<Pick<ReservoirSegment, 'name' | 'type'>>) => void
  renameSegment: (segmentId: string, name: string) => void
  setSegmentType: (segmentId: string, type: ReservoirSegmentType) => void
  removeSegment: (segmentId: string) => void
  moveSegment: (segmentId: string, direction: 'up' | 'down') => void
  setActiveSegment: (segmentId: string) => void
  setValidation: (report: ValidationReport | null) => void
  setSimulation: (result: SimulateResponse | null) => void
  setModulePreview: (scope: ModuleScope, result: ModulePreviewResponse | null) => void
  clearModulePreviews: () => void
  getModulePreview: (scope: ModuleScope) => ModulePreviewResponse | undefined
  setActiveProject: (id: number | null, name?: string | null) => void
  setLoading: (v: boolean) => void
  setError: (msg: string | null) => void
  reset: () => void
  uncertaintyGroups: UncertaintyParameterGroup[]
  groupCorrelationMatrix: GroupCorrelationMatrix | null
  groupCorrelationMode: GroupCorrelationMode
  setGroupCorrelationMode: (mode: GroupCorrelationMode) => void
  setGroupMatrixCell: (rowGroupId: string, colGroupId: string, rho: number) => void
  saveUncertaintyGroup: (group: UncertaintyParameterGroup) => void
  removeUncertaintyGroup: (groupId: string) => void
  loadExampleUncertaintyGroups: () => void
  getGroupDependencyContext: () => GroupDependencyContextPayload | null
}

const WorkflowContext = createContext<WorkflowState | null>(null)

function normalizeInput(next: SimulationInput): SimulationInput {
  return normalizeCalculationToggles(ensureCcopRiskInInput(next))
}

function cleanName(value: string, fallback: string): string {
  const trimmed = value.trim()
  return trimmed || fallback
}

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [reservoirs, setReservoirs] = useState<ReservoirItem[]>([])
  const [segments, setSegments] = useState<ReservoirSegment[]>([])
  const [tankInputs, setTankInputs] = useState<Record<string, SimulationInput>>({})
  const [activeReservoirId, setActiveReservoirId] = useState<string | null>(null)
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null)
  const [validation, setValidation] = useState<ValidationReport | null>(null)
  const [simulation, setSimulation] = useState<SimulateResponse | null>(null)
  const [modulePreviews, setModulePreviews] = useState<
    Partial<Record<ModuleScope, ModulePreviewResponse>>
  >({})
  const stored = readActiveProject()
  const [activeProjectId, setActiveProjectId] = useState<number | null>(stored?.id ?? null)
  const [activeProjectName, setActiveProjectName] = useState<string | null>(stored?.name ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uncertaintyGroups, setUncertaintyGroups] = useState<UncertaintyParameterGroup[]>([])
  const [groupCorrelationMatrix, setGroupCorrelationMatrix] =
    useState<GroupCorrelationMatrix | null>(null)
  const [groupCorrelationMode, setGroupCorrelationModeState] =
    useState<GroupCorrelationMode>('independent')

  const resolvedActiveReservoirId = useMemo(() => {
    if (activeReservoirId && reservoirs.some((r) => r.id === activeReservoirId)) {
      return activeReservoirId
    }
    return reservoirs[0]?.id ?? null
  }, [activeReservoirId, reservoirs])

  const resolvedActiveSegmentId = useMemo(() => {
    if (activeSegmentId && segments.some((s) => s.id === activeSegmentId)) {
      return activeSegmentId
    }
    return segments[0]?.id ?? null
  }, [activeSegmentId, segments])

  const activeTankKey = useMemo(() => {
    if (!resolvedActiveSegmentId || !resolvedActiveReservoirId) return null
    return tankId(resolvedActiveSegmentId, resolvedActiveReservoirId)
  }, [resolvedActiveSegmentId, resolvedActiveReservoirId])

  const input = useMemo(() => {
    if (!activeTankKey) return null
    return tankInputs[activeTankKey] ?? null
  }, [activeTankKey, tankInputs])

  const clearRunState = useCallback(() => {
    setValidation(null)
    setSimulation(null)
    setModulePreviews({})
  }, [])

  const getTankInput = useCallback(
    (segmentId: string, reservoirId: string) => {
      return tankInputs[tankId(segmentId, reservoirId)] ?? null
    },
    [tankInputs],
  )

  const setSegmentsFromInput = useCallback((next: SimulationInput | null) => {
    if (next == null) {
      setReservoirs([])
      setSegments([])
      setTankInputs({})
      setActiveReservoirId(null)
      setActiveSegmentId(null)
      return
    }
    const normalized = normalizeInput(next)
    const reservoir = createDefaultReservoir(1)
    const segment = createDefaultSegment(1)
    const segName = cleanName(normalized.zone_name ?? '', segment.name)
    segment.name = segName
    const key = tankId(segment.id, reservoir.id)
    setReservoirs([reservoir])
    setSegments([segment])
    setTankInputs({ [key]: { ...normalized, zone_name: `${segment.name},${reservoir.name}` } })
    setActiveReservoirId(reservoir.id)
    setActiveSegmentId(segment.id)
  }, [])

  const setInput = useCallback(
    (next: SimulationInput | null) => {
      if (next == null) {
        setReservoirs([])
        setSegments([])
        setTankInputs({})
        setActiveReservoirId(null)
        setActiveSegmentId(null)
        clearRunState()
        return
      }
      const normalized = normalizeInput(next)
      const reservoirId = resolvedActiveReservoirId
      const segmentId = resolvedActiveSegmentId

      if (!reservoirId || !segmentId) {
        const reservoir = createDefaultReservoir(1)
        const segment = createDefaultSegment(1)
        const key = tankId(segment.id, reservoir.id)
        setReservoirs([reservoir])
        setSegments([segment])
        setTankInputs({ [key]: normalized })
        setActiveReservoirId(reservoir.id)
        setActiveSegmentId(segment.id)
        return
      }

      setTankInputs((prev) => {
        const withActive = { ...prev, [tankId(segmentId, reservoirId)]: normalized }
        const withNtg = applySharedNtgToLinkedTanks(
          withActive,
          segments,
          reservoirs,
          segmentId,
          reservoirId,
          normalized,
        )
        const withHc = applySharedHcYieldToLinkedTanks(
          withNtg,
          segments,
          reservoirs,
          segmentId,
          reservoirId,
          normalized,
        )
        return applySharedCorrelationToLinkedTanks(
          withHc,
          segments,
          reservoirs,
          segmentId,
          reservoirId,
          normalized,
        )
      })
    },
    [resolvedActiveReservoirId, resolvedActiveSegmentId, reservoirs, segments, clearRunState],
  )

  const addReservoir = useCallback(() => {
    const newReservoir = createDefaultReservoir(reservoirs.length + 1)
    newReservoir.name = `Reservoir${reservoirs.length + 1}`
    const baseInput =
      input ??
      Object.values(tankInputs)[0] ??
      ({ ...createDefaultInput(), prospect_name: 'New Prospect' } as SimulationInput)
    let nextSegments = segments
    if (!nextSegments.length) {
      nextSegments = [createDefaultSegment(1)]
      setSegments(nextSegments)
      setActiveSegmentId(nextSegments[0].id)
    }
    setReservoirs((prev) => [...prev, newReservoir])
    setTankInputs((prev) => {
      const next = { ...prev }
      nextSegments.forEach((seg) => {
        next[tankId(seg.id, newReservoir.id)] = {
          ...baseInput,
          zone_name: `${seg.name},${newReservoir.name}`,
        }
      })
      return next
    })
    setActiveReservoirId(newReservoir.id)
    clearRunState()
  }, [reservoirs, segments, input, tankInputs, clearRunState])

  const renameReservoir = useCallback((reservoirId: string, name: string) => {
    const clean = name.trim()
    if (!clean) return
    setReservoirs((prev) =>
      prev.map((res) => (res.id === reservoirId ? { ...res, name: clean } : res)),
    )
  }, [])

  const toggleReservoir = useCallback((reservoirId: string) => {
    setReservoirs((prev) =>
      prev.map((res) => (res.id === reservoirId ? { ...res, enabled: !res.enabled } : res)),
    )
  }, [])

  const toggleReservoirSharedSimulation = useCallback((reservoirId: string) => {
    setReservoirs((prev) =>
      prev.map((res) =>
        res.id === reservoirId ? { ...res, shared_simulation: !res.shared_simulation } : res,
      ),
    )
  }, [])

  const propagateNtgForReservoir = useCallback(
    (reservoirId: string, sourceInput: SimulationInput) => {
      setTankInputs((prev) => {
        let next = { ...prev }
        segments.forEach((seg) => {
          const key = tankId(seg.id, reservoirId)
          const existing = next[key] ?? prev[key]
          if (existing) next[key] = mergeSharedNtgFields(existing, sourceInput)
        })
        return next
      })
    },
    [segments],
  )

  const propagateNtgForSegment = useCallback(
    (segmentId: string, sourceInput: SimulationInput) => {
      setTankInputs((prev) => {
        let next = { ...prev }
        reservoirs.forEach((res) => {
          const key = tankId(segmentId, res.id)
          const existing = next[key] ?? prev[key]
          if (existing) next[key] = mergeSharedNtgFields(existing, sourceInput)
        })
        return next
      })
    },
    [reservoirs],
  )

  const toggleReservoirSharedNtg = useCallback(
    (reservoirId: string) => {
      const res = reservoirs.find((r) => r.id === reservoirId)
      const turningOn = res && !res.shared_ntg
      setReservoirs((prev) =>
        prev.map((r) => (r.id === reservoirId ? { ...r, shared_ntg: !r.shared_ntg } : r)),
      )
      if (turningOn) {
        const sourceKey =
          resolvedActiveReservoirId === reservoirId && resolvedActiveSegmentId
            ? tankId(resolvedActiveSegmentId, reservoirId)
            : tankId(segments[0]?.id ?? '', reservoirId)
        const source = tankInputs[sourceKey]
        if (source) propagateNtgForReservoir(reservoirId, source)
      }
    },
    [
      reservoirs,
      segments,
      tankInputs,
      resolvedActiveReservoirId,
      resolvedActiveSegmentId,
      propagateNtgForReservoir,
    ],
  )

  const toggleSegmentSharedNtg = useCallback(
    (segmentId: string) => {
      const seg = segments.find((s) => s.id === segmentId)
      const turningOn = seg && !seg.shared_ntg
      setSegments((prev) =>
        prev.map((s) => (s.id === segmentId ? { ...s, shared_ntg: !s.shared_ntg } : s)),
      )
      if (turningOn) {
        const sourceKey =
          resolvedActiveSegmentId === segmentId && resolvedActiveReservoirId
            ? tankId(segmentId, resolvedActiveReservoirId)
            : tankId(segmentId, reservoirs[0]?.id ?? '')
        const source = tankInputs[sourceKey]
        if (source) propagateNtgForSegment(segmentId, source)
      }
    },
    [
      segments,
      reservoirs,
      tankInputs,
      resolvedActiveSegmentId,
      resolvedActiveReservoirId,
      propagateNtgForSegment,
    ],
  )

  const propagateHcYieldForReservoir = useCallback(
    (reservoirId: string, sourceInput: SimulationInput) => {
      setTankInputs((prev) => {
        const next = { ...prev }
        segments.forEach((seg) => {
          const key = tankId(seg.id, reservoirId)
          const existing = next[key] ?? prev[key]
          if (existing) next[key] = mergeSharedHcYieldFields(existing, sourceInput)
        })
        return next
      })
    },
    [segments],
  )

  const propagateHcYieldForSegment = useCallback(
    (segmentId: string, sourceInput: SimulationInput) => {
      setTankInputs((prev) => {
        const next = { ...prev }
        reservoirs.forEach((res) => {
          const key = tankId(segmentId, res.id)
          const existing = next[key] ?? prev[key]
          if (existing) next[key] = mergeSharedHcYieldFields(existing, sourceInput)
        })
        return next
      })
    },
    [reservoirs],
  )

  const toggleReservoirSharedHcYield = useCallback(
    (reservoirId: string) => {
      const res = reservoirs.find((r) => r.id === reservoirId)
      const turningOn = res && !res.shared_hc_yield
      setReservoirs((prev) =>
        prev.map((r) =>
          r.id === reservoirId ? { ...r, shared_hc_yield: !r.shared_hc_yield } : r,
        ),
      )
      if (turningOn) {
        const sourceKey =
          resolvedActiveReservoirId === reservoirId && resolvedActiveSegmentId
            ? tankId(resolvedActiveSegmentId, reservoirId)
            : tankId(segments[0]?.id ?? '', reservoirId)
        const source = tankInputs[sourceKey]
        if (source) propagateHcYieldForReservoir(reservoirId, source)
      }
    },
    [
      reservoirs,
      segments,
      tankInputs,
      resolvedActiveReservoirId,
      resolvedActiveSegmentId,
      propagateHcYieldForReservoir,
    ],
  )

  const toggleSegmentSharedHcYield = useCallback(
    (segmentId: string) => {
      const seg = segments.find((s) => s.id === segmentId)
      const turningOn = seg && !seg.shared_hc_yield
      setSegments((prev) =>
        prev.map((s) =>
          s.id === segmentId ? { ...s, shared_hc_yield: !s.shared_hc_yield } : s,
        ),
      )
      if (turningOn) {
        const sourceKey =
          resolvedActiveSegmentId === segmentId && resolvedActiveReservoirId
            ? tankId(segmentId, resolvedActiveReservoirId)
            : tankId(segmentId, reservoirs[0]?.id ?? '')
        const source = tankInputs[sourceKey]
        if (source) propagateHcYieldForSegment(segmentId, source)
      }
    },
    [
      segments,
      reservoirs,
      tankInputs,
      resolvedActiveSegmentId,
      resolvedActiveReservoirId,
      propagateHcYieldForSegment,
    ],
  )

  const propagateCorrelationForReservoir = useCallback(
    (reservoirId: string, sourceInput: SimulationInput) => {
      setTankInputs((prev) => {
        const next = { ...prev }
        segments.forEach((seg) => {
          const key = tankId(seg.id, reservoirId)
          const existing = next[key] ?? prev[key]
          if (existing) next[key] = mergeSharedCorrelationFields(existing, sourceInput)
        })
        return next
      })
    },
    [segments],
  )

  const propagateCorrelationForSegment = useCallback(
    (segmentId: string, sourceInput: SimulationInput) => {
      setTankInputs((prev) => {
        const next = { ...prev }
        reservoirs.forEach((res) => {
          const key = tankId(segmentId, res.id)
          const existing = next[key] ?? prev[key]
          if (existing) next[key] = mergeSharedCorrelationFields(existing, sourceInput)
        })
        return next
      })
    },
    [reservoirs],
  )

  const toggleReservoirSharedCorrelation = useCallback(
    (reservoirId: string) => {
      const res = reservoirs.find((r) => r.id === reservoirId)
      const turningOn = res && !res.shared_correlation
      setReservoirs((prev) =>
        prev.map((r) =>
          r.id === reservoirId
            ? { ...r, shared_correlation: !r.shared_correlation }
            : r,
        ),
      )
      if (turningOn) {
        const sourceKey =
          resolvedActiveReservoirId === reservoirId && resolvedActiveSegmentId
            ? tankId(resolvedActiveSegmentId, reservoirId)
            : tankId(segments[0]?.id ?? '', reservoirId)
        const source = tankInputs[sourceKey]
        if (source) propagateCorrelationForReservoir(reservoirId, source)
      }
    },
    [
      reservoirs,
      segments,
      tankInputs,
      resolvedActiveReservoirId,
      resolvedActiveSegmentId,
      propagateCorrelationForReservoir,
    ],
  )

  const toggleSegmentSharedCorrelation = useCallback(
    (segmentId: string) => {
      const seg = segments.find((s) => s.id === segmentId)
      const turningOn = seg && !seg.shared_correlation
      setSegments((prev) =>
        prev.map((s) =>
          s.id === segmentId ? { ...s, shared_correlation: !s.shared_correlation } : s,
        ),
      )
      if (turningOn) {
        const sourceKey =
          resolvedActiveSegmentId === segmentId && resolvedActiveReservoirId
            ? tankId(segmentId, resolvedActiveReservoirId)
            : tankId(segmentId, reservoirs[0]?.id ?? '')
        const source = tankInputs[sourceKey]
        if (source) propagateCorrelationForSegment(segmentId, source)
      }
    },
    [
      segments,
      reservoirs,
      tankInputs,
      resolvedActiveSegmentId,
      resolvedActiveReservoirId,
      propagateCorrelationForSegment,
    ],
  )

  const copyNrvNtgFromActive = useCallback(
    (scope: 'reservoir' | 'all') => {
      const segmentId = resolvedActiveSegmentId
      const reservoirId = resolvedActiveReservoirId
      if (!segmentId || !reservoirId) return
      const sourceKey = tankId(segmentId, reservoirId)
      const source = tankInputs[sourceKey]
      if (!source) return
      setTankInputs((prev) => {
        const next = { ...prev }
        segments.forEach((seg) => {
          reservoirs.forEach((res) => {
            if (scope === 'reservoir' && res.id !== reservoirId) return
            const key = tankId(seg.id, res.id)
            const existing = next[key]
            if (existing) next[key] = mergeSharedNtgFields(existing, source)
          })
        })
        return next
      })
      clearRunState()
    },
    [
      resolvedActiveSegmentId,
      resolvedActiveReservoirId,
      tankInputs,
      segments,
      reservoirs,
      clearRunState,
    ],
  )

  const removeReservoir = useCallback(
    (reservoirId: string) => {
      if (reservoirs.length <= 1) return
      const idx = reservoirs.findIndex((r) => r.id === reservoirId)
      if (idx < 0) return
      const nextReservoirs = reservoirs.filter((r) => r.id !== reservoirId)
      const fallback = nextReservoirs[Math.max(0, idx - 1)] ?? nextReservoirs[0]
      setReservoirs(nextReservoirs)
      setTankInputs((prev) => {
        const next: Record<string, SimulationInput> = {}
        Object.entries(prev).forEach(([key, value]) => {
          if (!key.endsWith(`::${reservoirId}`)) next[key] = value
        })
        return next
      })
      if (resolvedActiveReservoirId === reservoirId) setActiveReservoirId(fallback.id)
      clearRunState()
    },
    [reservoirs, resolvedActiveReservoirId, clearRunState],
  )

  const moveReservoir = useCallback((reservoirId: string, direction: 'up' | 'down') => {
    setReservoirs((prev) => {
      const idx = prev.findIndex((r) => r.id === reservoirId)
      if (idx < 0) return prev
      const nextIdx = direction === 'up' ? idx - 1 : idx + 1
      if (nextIdx < 0 || nextIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[nextIdx]] = [next[nextIdx], next[idx]]
      return next
    })
  }, [])

  const setActiveReservoir = useCallback(
    (reservoirId: string) => {
      setActiveReservoirId(reservoirId)
      clearRunState()
    },
    [clearRunState],
  )

  const addSegment = useCallback(
    (partial?: Partial<Pick<ReservoirSegment, 'name' | 'type'>>) => {
      const segment = createDefaultSegment(segments.length + 1)
      segment.name = partial?.name?.trim() || segment.name
      segment.type = partial?.type ?? segment.type
      const baseInput =
        input ??
        Object.values(tankInputs)[0] ??
        ({ ...createDefaultInput(), prospect_name: 'New Prospect' } as SimulationInput)
      let nextReservoirs = reservoirs
      if (!nextReservoirs.length) {
        nextReservoirs = [createDefaultReservoir(1)]
        setReservoirs(nextReservoirs)
        setActiveReservoirId(nextReservoirs[0].id)
      }
      setSegments((prev) => [...prev, segment])
      setTankInputs((prev) => {
        const next = { ...prev }
        nextReservoirs.forEach((res) => {
          next[tankId(segment.id, res.id)] = {
            ...baseInput,
            zone_name: `${segment.name},${res.name}`,
          }
        })
        return next
      })
      setActiveSegmentId(segment.id)
      clearRunState()
    },
    [segments, reservoirs, input, tankInputs, clearRunState],
  )

  const renameSegment = useCallback((segmentId: string, name: string) => {
    const clean = name.trim()
    if (!clean) return
    setSegments((prev) =>
      prev.map((seg) => (seg.id === segmentId ? { ...seg, name: clean } : seg)),
    )
    clearRunState()
  }, [clearRunState])

  const setSegmentType = useCallback((segmentId: string, type: ReservoirSegmentType) => {
    setSegments((prev) => prev.map((seg) => (seg.id === segmentId ? { ...seg, type } : seg)))
  }, [])

  const removeSegment = useCallback(
    (segmentId: string) => {
      if (segments.length <= 1) return
      const idx = segments.findIndex((s) => s.id === segmentId)
      if (idx < 0) return
      const nextSegments = segments.filter((s) => s.id !== segmentId)
      const fallback = nextSegments[Math.max(0, idx - 1)] ?? nextSegments[0]
      setSegments(nextSegments)
      setTankInputs((prev) => {
        const next: Record<string, SimulationInput> = {}
        Object.entries(prev).forEach(([key, value]) => {
          if (!key.startsWith(`${segmentId}::`)) next[key] = value
        })
        return next
      })
      if (resolvedActiveSegmentId === segmentId) setActiveSegmentId(fallback.id)
      clearRunState()
    },
    [segments, resolvedActiveSegmentId, clearRunState],
  )

  const moveSegment = useCallback((segmentId: string, direction: 'up' | 'down') => {
    setSegments((prev) => {
      const idx = prev.findIndex((s) => s.id === segmentId)
      if (idx < 0) return prev
      const nextIdx = direction === 'up' ? idx - 1 : idx + 1
      if (nextIdx < 0 || nextIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[nextIdx]] = [next[nextIdx], next[idx]]
      return next
    })
  }, [])

  const setActiveSegment = useCallback(
    (segmentId: string) => {
      setActiveSegmentId(segmentId)
      clearRunState()
    },
    [clearRunState],
  )

  const setActiveTank = useCallback(
    (segmentId: string, reservoirId: string) => {
      setActiveSegmentId(segmentId)
      setActiveReservoirId(reservoirId)
      clearRunState()
    },
    [clearRunState],
  )

  const getEnvelopeForSave = useCallback((): TankProjectEnvelope | null => {
    if (!segments.length || !reservoirs.length) return null
    return {
      schema_version: '1',
      segments,
      reservoirs,
      tank_inputs: tankInputs,
      active_segment_id: resolvedActiveSegmentId,
      active_reservoir_id: resolvedActiveReservoirId,
      uncertainty_groups: uncertaintyGroups.length ? uncertaintyGroups : undefined,
      group_correlation_matrix: groupCorrelationMatrix,
      group_correlation_mode: groupCorrelationMode,
    }
  }, [
    segments,
    reservoirs,
    tankInputs,
    resolvedActiveSegmentId,
    resolvedActiveReservoirId,
    uncertaintyGroups,
    groupCorrelationMatrix,
    groupCorrelationMode,
  ])

  const getGroupDependencyContext = useCallback((): GroupDependencyContextPayload | null => {
    if (!resolvedActiveSegmentId || !resolvedActiveReservoirId) return null
    if (!uncertaintyGroups.length) return null
    return {
      active_segment_id: resolvedActiveSegmentId,
      active_reservoir_id: resolvedActiveReservoirId,
      segment_ids: segments.map((s) => s.id),
      reservoir_ids: reservoirs.map((r) => r.id),
      uncertainty_groups: uncertaintyGroups,
      group_correlation_mode: groupCorrelationMode,
      group_correlation_matrix: groupCorrelationMatrix,
      tank_inputs: tankInputs,
    }
  }, [
    resolvedActiveSegmentId,
    resolvedActiveReservoirId,
    uncertaintyGroups,
    groupCorrelationMode,
    groupCorrelationMatrix,
    tankInputs,
    segments,
    reservoirs,
  ])

  const loadFromEnvelope = useCallback((envelope: TankProjectEnvelope) => {
    setSegments(envelope.segments)
    setReservoirs(envelope.reservoirs)
    const normalized: Record<string, SimulationInput> = {}
    Object.entries(envelope.tank_inputs).forEach(([key, value]) => {
      normalized[key] = normalizeInput(value)
    })
    setTankInputs(normalized)
    const segId =
      envelope.active_segment_id &&
      envelope.segments.some((s) => s.id === envelope.active_segment_id)
        ? envelope.active_segment_id
        : envelope.segments[0]?.id ?? null
    const resId =
      envelope.active_reservoir_id &&
      envelope.reservoirs.some((r) => r.id === envelope.active_reservoir_id)
        ? envelope.active_reservoir_id
        : envelope.reservoirs[0]?.id ?? null
    setActiveSegmentId(segId)
    setActiveReservoirId(resId)
    setUncertaintyGroups(envelope.uncertainty_groups ?? [])
    setGroupCorrelationMatrix(envelope.group_correlation_matrix ?? null)
    setGroupCorrelationModeState(envelope.group_correlation_mode ?? 'independent')
  }, [])

  const applyGroupsToMatrix = useCallback((groups: UncertaintyParameterGroup[]) => {
    setGroupCorrelationMatrix((prev) => syncGroupCorrelationMatrix(prev, groups))
  }, [])

  const saveUncertaintyGroup = useCallback(
    (group: UncertaintyParameterGroup) => {
      setUncertaintyGroups((prev) => {
        const idx = prev.findIndex((g) => g.id === group.id)
        const next =
          idx >= 0 ? prev.map((g, i) => (i === idx ? group : g)) : [...prev, group]
        applyGroupsToMatrix(next)
        return next
      })
      clearRunState()
    },
    [applyGroupsToMatrix, clearRunState],
  )

  const removeUncertaintyGroup = useCallback(
    (groupId: string) => {
      setUncertaintyGroups((prev) => {
        const next = prev.filter((g) => g.id !== groupId)
        applyGroupsToMatrix(next)
        return next
      })
      clearRunState()
    },
    [applyGroupsToMatrix, clearRunState],
  )

  const setGroupCorrelationMode = useCallback(
    (mode: GroupCorrelationMode) => {
      setGroupCorrelationModeState(mode)
      clearRunState()
    },
    [clearRunState],
  )

  const setGroupMatrixCellHandler = useCallback(
    (rowGroupId: string, colGroupId: string, rho: number) => {
      setGroupCorrelationMatrix((prev) => {
        if (!prev) return prev
        return setGroupMatrixCell(prev, rowGroupId, colGroupId, rho)
      })
      clearRunState()
    },
    [clearRunState],
  )

  const loadExampleUncertaintyGroups = useCallback(() => {
    if (reservoirs.length < 1 || segments.length < 3) return
    const r1 = reservoirs[0]
    const s1 = segments[0]
    const s2 = segments[1]
    const s3 = segments[2]
    const example: UncertaintyParameterGroup[] = [
      {
        id: 'ex_grv_all',
        name: 'GRV_all_Seg',
        parameter: 'grv',
        members: [],
        all_segments: true,
        all_reservoirs: true,
        notes: 'Prospect-wide GRV uncertainty driver',
      },
      {
        id: 'ex_poro_s12',
        name: 'Poro_R1_S1,2',
        parameter: 'porosity',
        members: [
          { segment_id: s1.id, reservoir_id: r1.id },
          { segment_id: s2.id, reservoir_id: r1.id },
        ],
      },
      {
        id: 'ex_poro_s3',
        name: 'Poro_R1_S3',
        parameter: 'porosity',
        members: [{ segment_id: s3.id, reservoir_id: r1.id }],
        notes: 'Diagenesis compartment',
      },
      {
        id: 'ex_sw_s12',
        name: 'Sw_R1_S1,2',
        parameter: 'saturation',
        members: [
          { segment_id: s1.id, reservoir_id: r1.id },
          { segment_id: s2.id, reservoir_id: r1.id },
        ],
      },
      {
        id: 'ex_sw_s3',
        name: 'Sw_R1_S3',
        parameter: 'saturation',
        members: [{ segment_id: s3.id, reservoir_id: r1.id }],
      },
    ]
    setUncertaintyGroups(example)
    const matrix = syncGroupCorrelationMatrix(null, example)
    if (matrix) {
      let m = matrix
      const set = (a: string, b: string, rho: number) => {
        m = setGroupMatrixCell(m, a, b, rho)
      }
      set('ex_poro_s12', 'ex_sw_s12', -0.8)
      set('ex_poro_s3', 'ex_sw_s3', 0.7)
      setGroupCorrelationMatrix(m)
    }
    setGroupCorrelationModeState('rank')
    clearRunState()
  }, [reservoirs, segments, clearRunState])

  const setActiveProject = useCallback((id: number | null, name?: string | null) => {
    setActiveProjectId(id)
    const n = name ?? null
    setActiveProjectName(n)
    writeActiveProject(id, n)
  }, [])

  const setModulePreview = useCallback(
    (scope: ModuleScope, result: ModulePreviewResponse | null) => {
      setModulePreviews((prev) => {
        if (result === null) {
          const next = { ...prev }
          delete next[scope]
          return next
        }
        return { ...prev, [scope]: result }
      })
    },
    [],
  )

  const getModulePreview = useCallback((scope: ModuleScope) => modulePreviews[scope], [modulePreviews])
  const clearModulePreviews = useCallback(() => setModulePreviews({}), [])

  const reset = useCallback(() => {
    setReservoirs([])
    setSegments([])
    setTankInputs({})
    setActiveReservoirId(null)
    setActiveSegmentId(null)
    setUncertaintyGroups([])
    setGroupCorrelationMatrix(null)
    setGroupCorrelationModeState('independent')
    clearRunState()
    setActiveProjectId(null)
    setActiveProjectName(null)
    setError(null)
  }, [clearRunState])

  const value = useMemo(
    () => ({
      reservoirs,
      segments,
      activeReservoirId: resolvedActiveReservoirId,
      activeSegmentId: resolvedActiveSegmentId,
      input,
      validation,
      simulation,
      modulePreviews,
      activeProjectId,
      activeProjectName,
      loading,
      error,
      setInput,
      getTankInput,
      setActiveTank,
      getEnvelopeForSave,
      loadFromEnvelope,
      setSegmentsFromInput,
      addReservoir,
      renameReservoir,
      toggleReservoir,
      toggleReservoirSharedSimulation,
      toggleReservoirSharedNtg,
      toggleSegmentSharedNtg,
      toggleReservoirSharedHcYield,
      toggleSegmentSharedHcYield,
      toggleReservoirSharedCorrelation,
      toggleSegmentSharedCorrelation,
      copyNrvNtgFromActive,
      removeReservoir,
      moveReservoir,
      setActiveReservoir,
      addSegment,
      renameSegment,
      setSegmentType,
      removeSegment,
      moveSegment,
      setActiveSegment,
      setValidation,
      setSimulation,
      setModulePreview,
      clearModulePreviews,
      getModulePreview,
      setActiveProject,
      setLoading,
      setError,
      reset,
      uncertaintyGroups,
      groupCorrelationMatrix,
      groupCorrelationMode,
      setGroupCorrelationMode,
      setGroupMatrixCell: setGroupMatrixCellHandler,
      saveUncertaintyGroup,
      removeUncertaintyGroup,
      loadExampleUncertaintyGroups,
      getGroupDependencyContext,
    }),
    [
      reservoirs,
      segments,
      resolvedActiveReservoirId,
      resolvedActiveSegmentId,
      input,
      validation,
      simulation,
      modulePreviews,
      activeProjectId,
      activeProjectName,
      loading,
      error,
      setInput,
      getTankInput,
      setActiveTank,
      getEnvelopeForSave,
      loadFromEnvelope,
      setSegmentsFromInput,
      addReservoir,
      renameReservoir,
      toggleReservoir,
      toggleReservoirSharedSimulation,
      toggleReservoirSharedNtg,
      toggleSegmentSharedNtg,
      toggleReservoirSharedHcYield,
      toggleSegmentSharedHcYield,
      toggleReservoirSharedCorrelation,
      toggleSegmentSharedCorrelation,
      copyNrvNtgFromActive,
      removeReservoir,
      moveReservoir,
      setActiveReservoir,
      addSegment,
      renameSegment,
      setSegmentType,
      removeSegment,
      moveSegment,
      setActiveSegment,
      setModulePreview,
      clearModulePreviews,
      getModulePreview,
      setActiveProject,
      reset,
      uncertaintyGroups,
      groupCorrelationMatrix,
      groupCorrelationMode,
      setGroupCorrelationMode,
      setGroupMatrixCellHandler,
      saveUncertaintyGroup,
      removeUncertaintyGroup,
      loadExampleUncertaintyGroups,
      getGroupDependencyContext,
    ],
  )

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>
}

export function useWorkflow() {
  const ctx = useContext(WorkflowContext)
  if (!ctx) throw new Error('useWorkflow must be used within WorkflowProvider')
  return ctx
}
