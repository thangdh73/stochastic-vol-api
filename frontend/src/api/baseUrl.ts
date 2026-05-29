/**
 * Build API URLs for dev (Vite proxy), same-origin production (nginx), or split API host.
 *
 * Env (production build):
 * - VITE_API_BASE — prefix before /api and /health, e.g. `/technical-corner/stochastic-volume`
 *   Leave empty when the API is on the same host and nginx proxies /api to the backend.
 * - VITE_API_ORIGIN — full origin for a separate API, e.g. `https://api.example.com`
 */
function normalizeBase(value: string | undefined): string {
  if (!value) return ''
  return value.replace(/\/$/, '')
}

export function apiUrl(path: string): string {
  const origin = normalizeBase(import.meta.env.VITE_API_ORIGIN as string | undefined)
  const prefix = normalizeBase(import.meta.env.VITE_API_BASE as string | undefined)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (origin) return `${origin}${normalizedPath}`
  if (prefix) return `${prefix}${normalizedPath}`
  return normalizedPath
}

/** React Router basename (no trailing slash). Uses Vite `base`. */
export function routerBasename(): string | undefined {
  const base = (import.meta.env.BASE_URL as string | undefined) ?? '/'
  const trimmed = base.replace(/\/$/, '')
  return trimmed || undefined
}
