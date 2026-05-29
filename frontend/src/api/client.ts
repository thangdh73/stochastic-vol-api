import type {
  DistributionPreviewResponse,
  DistributionSpec,
  HealthResponse,
  InputSet,
  ModulePreviewResponse,
  ModuleScope,
  Prospect,
  PerturbationTornadoResponse,
  GroupDependencyContextPayload,
  SimulateResponse,
  SimulationInput,
  ValidationReport,
} from '../types/api'
import { prepareTankForApi } from '../utils/ensureSimulationReady'
import { sanitizeInputForSave } from '../utils/sanitizeInputForSave'
import { apiUrl } from './baseUrl'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function prepareContextForApi(
  context?: GroupDependencyContextPayload,
): GroupDependencyContextPayload | null {
  if (!context) return null
  const tank_inputs = context.tank_inputs
    ? Object.fromEntries(
        Object.entries(context.tank_inputs).map(([key, tank]) => [
          key,
          prepareTankForApi(tank),
        ]),
      )
    : undefined
  return { ...context, tank_inputs }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), init)
  if (!res.ok) {
    let detail: unknown = res.statusText
    try {
      detail = await res.json()
    } catch {
      /* ignore */
    }
    const err = new Error(JSON.stringify(detail))
    ;(err as Error & { status: number }).status = res.status
    throw err
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  health: () => request<HealthResponse>('/health'),

  getPm3xdCase: () => request<SimulationInput>('/api/validation-cases/pm3xd'),

  validate: (input: SimulationInput) => {
    const payload = prepareTankForApi(input)
    return request<ValidationReport>('/api/validate', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    })
  },

  simulate: (
    input: SimulationInput,
    includeArrays = false,
    context?: GroupDependencyContextPayload,
  ) => {
    const payload = prepareTankForApi(input)
    return request<SimulateResponse>('/api/simulate', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        input: payload,
        options: { include_arrays: includeArrays },
        context: prepareContextForApi(context),
      }),
    })
  },

  simulateModulePreview: (input: SimulationInput, scope: ModuleScope) => {
    const payload = prepareTankForApi(input)
    return request<ModulePreviewResponse>('/api/simulate/preview', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ input: payload, scope }),
    })
  },

  simulateDistributionPreview: (
    distribution: DistributionSpec,
    nIterations: number,
    seed: number,
    variableKind: 'generic' | 'fraction' | 'positive_resource' = 'generic',
  ) =>
    request<DistributionPreviewResponse>('/api/simulate/distribution-preview', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        distribution,
        n_iterations: nIterations,
        seed,
        variable_kind: variableKind,
      }),
    }),

  fetchPerturbationTornado: (
    input: SimulationInput,
    target: string,
    context?: GroupDependencyContextPayload,
    scopeType: 'prospect' | 'reservoir' | 'segment' | 'tank' = 'prospect',
    scopeId?: string,
  ) => {
    const payload = prepareTankForApi(input)
    return request<PerturbationTornadoResponse>('/api/simulate/tornado-perturbation', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        input: payload,
        target,
        context: prepareContextForApi(context),
        scope_type: scopeType,
        scope_id: scopeId ?? null,
      }),
    })
  },

  listProspects: () => request<Prospect[]>('/api/prospects'),

  createProspect: (name: string, metadata: Record<string, unknown> = {}) =>
    request<Prospect>('/api/prospects', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ name, metadata }),
    }),

  getProspect: (id: number) => request<Prospect>(`/api/prospects/${id}`),

  updateProspect: (
    id: number,
    patch: { name?: string; metadata?: Record<string, unknown> },
  ) =>
    request<Prospect>(`/api/prospects/${id}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify(patch),
    }),

  deleteProspect: (id: number) =>
    request<void>(`/api/prospects/${id}`, {
      method: 'DELETE',
    }),

  listInputSets: (prospectId: number) =>
    request<InputSet[]>(`/api/prospects/${prospectId}/input-sets`),

  saveInputSet: (prospectId: number, input: SimulationInput) => {
    const payload = sanitizeInputForSave(input)
    return request<InputSet>(`/api/prospects/${prospectId}/input-sets`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    })
  },

  /** Latest saved inputs for a prospect (most recent input set). */
  async loadLatestProjectInput(prospectId: number): Promise<SimulationInput> {
    const sets = await request<InputSet[]>(`/api/prospects/${prospectId}/input-sets`)
    if (!sets.length) {
      throw new Error('No saved input sets for this project.')
    }
    const latest = sets[0]
    return latest.input as SimulationInput
  },

  persistSimulation: (prospectId: number, input: SimulationInput) =>
    request<SimulateResponse & { simulation_run_id: number; input_set_id: number }>(
      `/api/prospects/${prospectId}/simulation-runs`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ input, options: { include_arrays: true } }),
      },
    ),
}
