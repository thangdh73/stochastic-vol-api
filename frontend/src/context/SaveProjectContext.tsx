import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../api/client'
import { formatApiError } from '../api/errors'
import { TANK_ENVELOPE_META_KEY } from '../utils/tankEnvelope'
import { useWorkflow } from './WorkflowContext'

function envelopeFingerprint(envelope: unknown): string {
  try {
    return JSON.stringify(envelope)
  } catch {
    return String(Date.now())
  }
}

type SaveProjectContextValue = {
  saveProject: (nameOverride?: string) => Promise<boolean>
  saveOk: string | null
  setSaveOk: (msg: string | null) => void
  saveError: string | null
  setSaveError: (msg: string | null) => void
  projectName: string
  setProjectName: (name: string) => void
  loading: boolean
  canSave: boolean
  hasUnsavedChanges: boolean
  markSaved: () => void
  resetSaved: () => void
  tankCount: number
  activeProjectId: number | null
}

const SaveProjectContext = createContext<SaveProjectContextValue | null>(null)

export function SaveProjectProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const {
    input,
    activeProjectId,
    activeProjectName,
    getEnvelopeForSave,
    setInput,
    setActiveProject,
    setLoading,
    loading,
    segments,
    reservoirs,
  } = useWorkflow()

  const [projectName, setProjectName] = useState('')
  const [saveOk, setSaveOk] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null)

  const currentFingerprint = useMemo(() => {
    const envelope = getEnvelopeForSave()
    if (!envelope || !input) return null
    return envelopeFingerprint({
      envelope,
      prospect_name: projectName.trim() || input.prospect_name,
      basin: input.basin,
      formation: input.formation,
      country: input.country,
    })
  }, [getEnvelopeForSave, input, projectName])

  const hasUnsavedChanges =
    currentFingerprint != null &&
    (savedFingerprint == null || savedFingerprint !== currentFingerprint)

  useEffect(() => {
    if (!input) return
    setProjectName(activeProjectName ?? input.prospect_name ?? 'New Prospect')
  }, [input, activeProjectName])

  const markSaved = useCallback(() => {
    if (currentFingerprint) setSavedFingerprint(currentFingerprint)
  }, [currentFingerprint])

  const resetSaved = useCallback(() => {
    setSavedFingerprint(null)
  }, [])

  const saveProject = useCallback(
    async (nameOverride?: string) => {
      if (!input) return false
      const name = (nameOverride ?? projectName).trim() || input.prospect_name || 'Untitled prospect'
      setLoading(true)
      setSaveError(null)
      setSaveOk(null)
      try {
        let prospectId = activeProjectId
        const envelope = getEnvelopeForSave()
        const meta: Record<string, unknown> = {
          basin: input.basin ?? '',
          formation: input.formation ?? '',
          country: input.country ?? '',
          estimating_method: input.estimating_method ?? 'nrv_grv_yield',
        }
        if (envelope) meta[TANK_ENVELOPE_META_KEY] = envelope
        if (prospectId == null) {
          const created = await api.createProspect(name, meta)
          prospectId = created.id
        } else {
          await api.updateProspect(prospectId, { name, metadata: meta })
        }
        const syncedInput = { ...input, prospect_name: name }
        setInput(syncedInput)
        setProjectName(name)
        const saved = await api.saveInputSet(prospectId, syncedInput)
        setActiveProject(prospectId, name)
        const tanks = envelope ? envelope.segments.length * envelope.reservoirs.length : 1
        const tankNote = tanks > 1 ? ` All ${tanks} tanks saved.` : ''
        setSaveOk(
          activeProjectId != null
            ? `Saved “${name}” (input set #${saved.id}).${tankNote}`
            : `Created “${name}” (input set #${saved.id}).${tankNote}`,
        )
        setSavedFingerprint(
          envelopeFingerprint({
            envelope,
            prospect_name: name,
            basin: syncedInput.basin,
            formation: syncedInput.formation,
            country: syncedInput.country,
          }),
        )
        await queryClient.invalidateQueries({ queryKey: ['prospects'] })
        return true
      } catch (e) {
        setSaveError(formatApiError(e, 'Save failed'))
        return false
      } finally {
        setLoading(false)
      }
    },
    [
      input,
      projectName,
      activeProjectId,
      getEnvelopeForSave,
      setInput,
      setActiveProject,
      setLoading,
      queryClient,
    ],
  )

  const tankCount = Math.max(1, segments.length) * Math.max(1, reservoirs.length)

  const value = useMemo(
    () => ({
      saveProject,
      saveOk,
      setSaveOk,
      saveError,
      setSaveError,
      projectName,
      setProjectName,
      loading,
      canSave: Boolean(input),
      hasUnsavedChanges,
      markSaved,
      resetSaved,
      tankCount,
      activeProjectId,
    }),
    [
      saveProject,
      saveOk,
      projectName,
      loading,
      input,
      hasUnsavedChanges,
      markSaved,
      resetSaved,
      tankCount,
      activeProjectId,
    ],
  )

  return <SaveProjectContext.Provider value={value}>{children}</SaveProjectContext.Provider>
}

export function useSaveProject(): SaveProjectContextValue {
  const ctx = useContext(SaveProjectContext)
  if (!ctx) {
    throw new Error('useSaveProject must be used within SaveProjectProvider')
  }
  return ctx
}
