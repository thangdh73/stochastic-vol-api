import { Outlet } from 'react-router-dom'
import { MainSubNav } from '../components/MainSubNav'
import { WorkflowGate } from '../components/WorkflowGate'

const OUTPUT_SUB_PAGES = [
  { to: '/output/results', label: 'Results', end: true },
  { to: '/output/simulation', label: 'Simulation' },
  { to: '/output/charts', label: 'Charts & QC' },
  { to: '/output/export', label: 'Export' },
] as const

export function OutputSectionLayout() {
  return (
    <div>
      <h1 className="page-title">Output</h1>
      <MainSubNav title="Output sub-pages" items={[...OUTPUT_SUB_PAGES]} />
      <WorkflowGate>
        <Outlet />
      </WorkflowGate>
    </div>
  )
}
