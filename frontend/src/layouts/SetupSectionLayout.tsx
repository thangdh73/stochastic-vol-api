import { Outlet } from 'react-router-dom'
import { MainSubNav } from '../components/MainSubNav'
import { ProjectSaveBar } from '../components/ProjectSaveBar'
import { ValidateBar } from '../components/ValidateBar'
import { WorkflowGate } from '../components/WorkflowGate'

const SETUP_SUB_PAGES = [
  { to: '/setup/overview', label: 'Overview', end: true },
  { to: '/setup/prospect', label: 'Prospect setting' },
] as const

export function SetupSectionLayout() {
  return (
    <div>
      <h1 className="page-title">Setup</h1>
      <ProjectSaveBar variant="setup" />
      <MainSubNav title="Setup" items={[...SETUP_SUB_PAGES]} />
      <WorkflowGate>
        <Outlet />
        <ValidateBar />
      </WorkflowGate>
    </div>
  )
}
