import { Outlet } from 'react-router-dom'
import { MainSubNav } from '../components/MainSubNav'
import { ProjectSaveBar } from '../components/ProjectSaveBar'
import { ValidateBar } from '../components/ValidateBar'
import { WorkflowGate } from '../components/WorkflowGate'

const INPUT_TABS = [
  { to: '/input/rock-volume', label: 'Rock volume', end: true },
  { to: '/input/hc-yield', label: 'HC yield' },
] as const

export function InputSectionLayout() {
  return (
    <div className="input-section">
      <h1 className="page-title">Input</h1>
      <ProjectSaveBar variant="compact" />
      <MainSubNav title="Input" items={[...INPUT_TABS]} />
      <WorkflowGate>
        <Outlet />
        <ValidateBar />
      </WorkflowGate>
    </div>
  )
}
