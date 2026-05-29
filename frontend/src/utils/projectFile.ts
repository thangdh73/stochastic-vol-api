import type { SimulationInput } from '../types/api'
import { APP_TITLE } from '../constants/appBranding'
import {
  isTankEnvelope,
  type TankProjectEnvelope,
} from './tankEnvelope'

export const MMRA_PROJECT_FILE_SCHEMA = 'mmra_project_v1' as const
export const MMRA_PROJECT_FILE_EXTENSION = '.mmra.json'

export interface MmraProjectFileMetadata {
  basin?: string
  formation?: string
  country?: string
  estimating_method?: string
}

export interface MmraProjectFile {
  schema_version: typeof MMRA_PROJECT_FILE_SCHEMA
  exported_at: string
  app: string
  project_name: string
  metadata: MmraProjectFileMetadata
  envelope: TankProjectEnvelope
}

export class ProjectFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectFileError'
  }
}

function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || 'mmra_project'
}

function metadataFromInput(input: SimulationInput): MmraProjectFileMetadata {
  return {
    basin: input.basin ?? '',
    formation: input.formation ?? '',
    country: input.country ?? '',
    estimating_method: input.estimating_method ?? 'nrv_grv_yield',
  }
}

function syncProspectName(
  envelope: TankProjectEnvelope,
  projectName: string,
): TankProjectEnvelope {
  const name = projectName.trim() || 'Untitled prospect'
  const tank_inputs = Object.fromEntries(
    Object.entries(envelope.tank_inputs).map(([key, value]) => [
      key,
      { ...value, prospect_name: name },
    ]),
  )
  return { ...envelope, tank_inputs }
}

export function buildProjectFile(
  projectName: string,
  input: SimulationInput,
  envelope: TankProjectEnvelope,
): MmraProjectFile {
  if (!isTankEnvelope(envelope)) {
    throw new ProjectFileError('Project envelope is incomplete — check tanks and setup.')
  }
  const name = projectName.trim() || input.prospect_name || 'Untitled prospect'
  return {
    schema_version: MMRA_PROJECT_FILE_SCHEMA,
    exported_at: new Date().toISOString(),
    app: APP_TITLE,
    project_name: name,
    metadata: metadataFromInput(input),
    envelope: syncProspectName(envelope, name),
  }
}

export function isMmraProjectFile(value: unknown): value is MmraProjectFile {
  if (!value || typeof value !== 'object') return false
  const file = value as MmraProjectFile
  return (
    file.schema_version === MMRA_PROJECT_FILE_SCHEMA &&
    typeof file.project_name === 'string' &&
    isTankEnvelope(file.envelope)
  )
}

/** Accept full project files or a bare tank envelope (legacy / manual export). */
export function parseProjectFilePayload(raw: unknown): MmraProjectFile {
  if (isMmraProjectFile(raw)) return raw

  if (isTankEnvelope(raw)) {
    const firstInput = Object.values(raw.tank_inputs)[0]
    const name = firstInput?.prospect_name ?? 'Imported prospect'
    return {
      schema_version: MMRA_PROJECT_FILE_SCHEMA,
      exported_at: new Date().toISOString(),
      app: APP_TITLE,
      project_name: name,
      metadata: firstInput ? metadataFromInput(firstInput) : {},
      envelope: raw,
    }
  }

  throw new ProjectFileError(
    'Unrecognized project file. Expected a .mmra.json export from this app.',
  )
}

export function parseProjectFileJson(text: string): MmraProjectFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new ProjectFileError('File is not valid JSON.')
  }
  return parseProjectFilePayload(parsed)
}

export function projectFileDownloadName(projectName: string): string {
  return `${sanitizeFilename(projectName)}${MMRA_PROJECT_FILE_EXTENSION}`
}

export function downloadProjectFile(file: MmraProjectFile): void {
  const json = JSON.stringify(file, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = projectFileDownloadName(file.project_name)
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function readProjectFileFromBlob(blob: Blob): Promise<MmraProjectFile> {
  const text = await blob.text()
  return parseProjectFileJson(text)
}
