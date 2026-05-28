import { Link } from 'react-router-dom'
import { UncertaintyGroupsPanel } from '../components/UncertaintyGroupsPanel'
import { WorkflowGate } from '../components/WorkflowGate'

export function GroupWorkbenchPage() {
  return (
    <div>
      <h1 className="page-title">Group</h1>
      <p className="page-desc">
        Build uncertainty groups by parameter, segment, and reservoir before running dependency analysis.
      </p>
      <WorkflowGate>
        <div className="card classic-toolbar">
          <div className="classic-toolbar-row">
            <strong>Group builder</strong>
            <Link to="/dependency">Back to Dependency</Link>
            <Link to="/correlations">Open correlation matrix</Link>
          </div>
        </div>
        <UncertaintyGroupsPanel />
      </WorkflowGate>
    </div>
  )
}
