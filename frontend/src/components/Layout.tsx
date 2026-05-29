import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { APP_DOCUMENT_TITLE, APP_TAGLINE, APP_TITLE } from '../constants/appBranding'
import { useAuth } from '../context/AuthContext'
import {
  EstimatingMethodBanner,
  EstimatingMethodRouteGuard,
} from './EstimatingMethodBanner'
import { useWorkflow } from '../context/WorkflowContext'
import { computeModuleStatuses, type ModuleKey } from '../utils/moduleStatus'
import './Layout.css'

const MAIN_NAV = [
  { to: '/dashboard', label: 'Projects' },
  { to: '/setup', label: 'Setup' },
  { to: '/input', label: 'Input' },
  { to: '/dependency', label: 'Dependency' },
  { to: '/output', label: 'Output' },
  { to: '/tornado', label: 'Tornado' },
  { to: '/expectation-curve', label: 'Expectation Curve' },
] as const

export function Layout() {
  const { input, validation, simulation } = useWorkflow()
  const { authRequired, email, logout } = useAuth()
  const navigate = useNavigate()
  const status = computeModuleStatuses(input, validation, Boolean(simulation))

  useEffect(() => {
    document.title = APP_DOCUMENT_TITLE
  }, [])

  const keyForRoute = (to: string): ModuleKey | null => {
    switch (to) {
      case '/dashboard':
        return null
      case '/setup':
        return 'prospect'
      case '/input':
        return 'area'
      case '/dependency':
        return 'correlations'
      case '/output':
        return 'results'
      default:
        return null
    }
  }

  const badgeFor = (key: ModuleKey | null) => {
    if (!key) return null
    const s = status[key]
    if (s === 'complete') return <span className="nav-badge ok">OK</span>
    if (s === 'skipped') return <span className="nav-badge skip">Skipped</span>
    if (s === 'blocked') return <span className="nav-badge bad">Blocked</span>
    if (s === 'incomplete') return null
    return null
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-title">{APP_TITLE}</span>
          <span className="brand-sub">{APP_TAGLINE}</span>
        </div>
        <nav className="nav">
          {MAIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <span>{item.label}</span>
              {badgeFor(keyForRoute(item.to))}
            </NavLink>
          ))}
        </nav>
        {authRequired && email && (
          <div className="sidebar-auth">
            <span className="sidebar-auth-email" title={email}>
              {email}
            </span>
            <button
              type="button"
              className="sidebar-auth-logout"
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </aside>
      <main className="main">
        <EstimatingMethodBanner />
        <EstimatingMethodRouteGuard />
        <Outlet />
      </main>
    </div>
  )
}
