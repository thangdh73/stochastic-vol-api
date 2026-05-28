import { Link } from 'react-router-dom'
import { GroupDependencySection } from '../components/GroupDependencySection'
import { ValidateBar } from '../components/ValidateBar'
import { WorkflowGate } from '../components/WorkflowGate'

export function DependencyWorkbenchPage() {
  return (
    <div>
      <h1 className="page-title">Dependency</h1>
      <p className="page-desc">
        Configure grouped dependencies and correlations in a single workspace.
      </p>

      <WorkflowGate>
        <div className="card classic-toolbar">
          <div className="classic-toolbar-row">
            <strong>Dependency controls</strong>
            <Link to="/group">Open Group tab</Link>
            <Link to="/correlations">Open detailed matrix</Link>
          </div>
        </div>
        <GroupDependencySection />
        <ValidateBar />
      </WorkflowGate>
    </div>
  )
}
