const KEY_ID = 'mmra_active_project_id'
const KEY_NAME = 'mmra_active_project_name'

export function readActiveProject(): { id: number; name: string } | null {
  try {
    const idRaw = sessionStorage.getItem(KEY_ID)
    const name = sessionStorage.getItem(KEY_NAME)
    if (!idRaw || !name) return null
    const id = Number(idRaw)
    if (!Number.isFinite(id)) return null
    return { id, name }
  } catch {
    return null
  }
}

export function writeActiveProject(id: number | null, name: string | null): void {
  try {
    if (id == null || !name) {
      sessionStorage.removeItem(KEY_ID)
      sessionStorage.removeItem(KEY_NAME)
      return
    }
    sessionStorage.setItem(KEY_ID, String(id))
    sessionStorage.setItem(KEY_NAME, name)
  } catch {
    /* ignore */
  }
}
