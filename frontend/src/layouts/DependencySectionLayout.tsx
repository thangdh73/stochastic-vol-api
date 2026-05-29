import { Outlet } from 'react-router-dom'
import { MainSubNav } from '../components/MainSubNav'
import { WorkflowGate } from '../components/WorkflowGate'

const DEPENDENCY_SUB_PAGES = [
  { to: '/dependency', label: 'Group matrix', end: true },
  { to: '/dependency/groups', label: 'Groups' },
  { to: '/dependency/correlations', label: 'Correlations' },
  { to: '/dependency/chance', label: 'Chance' },
] as const

export function DependencySectionLayout() {
  return (
    <div>
      <h1 className="page-title">Dependency</h1>
      <MainSubNav title="Dependency sub-pages" items={[...DEPENDENCY_SUB_PAGES]} />
      <WorkflowGate>
        <Outlet />
      </WorkflowGate>
    </div>
  )
}
