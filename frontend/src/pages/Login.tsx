import { type FormEvent, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { APP_TAGLINE, APP_TITLE } from '../constants/appBranding'
import { useAuth } from '../context/AuthContext'
import '../components/Layout.css'

export function LoginPage() {
  const { authRequired, isAuthenticated, loading, login } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/setup/overview'

  if (!loading && !authRequired) {
    return <Navigate to={from} replace />
  }

  if (!loading && isAuthenticated) {
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">{APP_TITLE}</h1>
        <p className="login-sub">{APP_TAGLINE}</p>
        <p className="login-hint">Sign in to use the stochastic volumetrics workspace.</p>
        <form className="login-form" onSubmit={onSubmit}>
          <label className="login-label">
            Email
            <input
              type="email"
              className="login-input"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="login-label">
            Password
            <input
              type="password"
              className="login-input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-submit" disabled={submitting || loading}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
