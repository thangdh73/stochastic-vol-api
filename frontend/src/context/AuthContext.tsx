import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { apiUrl } from '../api/baseUrl'
import { clearAuthSession, getAccessToken, getStoredEmail, setAuthSession } from '../utils/authToken'

type AuthState = {
  email: string | null
  authRequired: boolean
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

async function fetchAuthStatus(): Promise<boolean> {
  const res = await fetch(apiUrl('/api/auth/status'))
  if (!res.ok) return false
  const data = (await res.json()) as { auth_enabled?: boolean }
  return Boolean(data.auth_enabled)
}

async function fetchMe(token: string): Promise<string | null> {
  const res = await fetch(apiUrl('/api/auth/me'), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { email?: string }
  return data.email ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authRequired, setAuthRequired] = useState(true)
  const [email, setEmail] = useState<string | null>(getStoredEmail())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const required = await fetchAuthStatus()
        if (cancelled) return
        setAuthRequired(required)
        if (!required) {
          setEmail(null)
          clearAuthSession()
          return
        }
        const token = getAccessToken()
        if (!token) {
          setEmail(null)
          return
        }
        const me = await fetchMe(token)
        if (cancelled) return
        if (me) {
          setEmail(me)
        } else {
          clearAuthSession()
          setEmail(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (loginEmail: string, password: string) => {
    const res = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail, password }),
    })
    if (!res.ok) {
      let detail = 'Login failed'
      try {
        const body = (await res.json()) as { detail?: string }
        if (body.detail) detail = body.detail
      } catch {
        /* ignore */
      }
      throw new Error(detail)
    }
    const data = (await res.json()) as { access_token: string; email: string }
    setAuthSession(data.access_token, data.email)
    setEmail(data.email)
    setAuthRequired(true)
  }, [])

  const logout = useCallback(() => {
    clearAuthSession()
    setEmail(null)
  }, [])

  const value = useMemo(
    () => ({
      email,
      authRequired,
      loading,
      isAuthenticated: !authRequired || Boolean(email && getAccessToken()),
      login,
      logout,
    }),
    [email, authRequired, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
