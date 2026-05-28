import { NavLink, Outlet } from 'react-router-dom'
import { APP_TAGLINE, APP_TITLE } from '../constants/appBranding'
import {
  EstimatingMethodBanner,
  EstimatingMethodRouteGuard,
} from './EstimatingMethodBanner'
import { useWorkflow } from '../context/WorkflowContext'
import { effectiveEstimatingMethod } from '../utils/estimatingMethod'
import { computeModuleStatuses, type ModuleKey } from '../utils/moduleStatus'
import './Layout.css'

const REFERENCE_NAV = [
  { to: '/setup', label: 'Setup' },
  { to: '/input', label: 'Input' },
  { to: '/dependency', label: 'Dependency' },
  { to: '/output', label: 'Output' },
  { to: '/group', label: 'Group' },
  { to: '/tornado', label: 'Tornado' },
  { to: '/expectation-curve', label: 'Expectation Curve' },
] as const

const LEGACY_NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/prospect', label: 'Prospect Setup' },
  { to: '/area', label: 'Area' },
  { to: '/net-pay', label: 'Net Pay' },
  { to: '/nrv', label: 'NRV / GRV' },
  { to: '/hc-yield', label: 'HC Yield' },
  { to: '/chance', label: 'Chance' },
  { to: '/correlations', label: 'Correlations' },
  { to: '/simulation', label: 'Simulation' },
  { to: '/results', label: 'Results' },
  { to: '/charts', label: 'Charts & QC' },
  { to: '/qaqc', label: 'QA/QC' },
  { to: '/export', label: 'Export' },
] as const

export function Layout() {
  const { input, validation, simulation } = useWorkflow()
  const method = input ? effectiveEstimatingMethod(input) : 'area_net_pay_yield'
  const status = computeModuleStatuses(input, validation, Boolean(simulation))

  const keyForRoute = (to: string): ModuleKey | null => {
    switch (to) {
      case '/setup':
      case '/prospect':
        return 'prospect'
      case '/input':
      case '/area':
        return 'area'
      case '/net-pay':
        return 'net_pay'
      case '/nrv':
        return 'nrv'
      case '/hc-yield':
        return 'hc_yield'
      case '/chance':
        return 'chance'
      case '/dependency':
      case '/correlations':
        return 'correlations'
      case '/simulation':
        return 'simulation'
      case '/output':
      case '/results':
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
    if (s === 'incomplete') return <span className="nav-badge warn">Todo</span>
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
          <p className="nav-section-label">Reference tabs</p>
          {REFERENCE_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              <span>{item.label}</span>
              {badgeFor(keyForRoute(item.to))}
            </NavLink>
          ))}
          <p className="nav-section-label">Legacy pages</p>
          {LEGACY_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                isActive ? 'nav-link active nav-link-legacy' : 'nav-link nav-link-legacy'
              }
            >
              <span>{item.label}</span>
              {badgeFor(keyForRoute(item.to))}
            </NavLink>
          ))}
        </nav>
        <p className="convention-note">
          Mode: {method === 'nrv_grv_yield' ? 'NRV x HC Yield' : 'Area x Net Pay x HC Yield'}. P90
          = conservative (small), P10 = upside (large).
        </p>
      </aside>
      <main className="main">
        <EstimatingMethodBanner />
        <EstimatingMethodRouteGuard />
        <Outlet />
      </main>
    </div>
  )
}
