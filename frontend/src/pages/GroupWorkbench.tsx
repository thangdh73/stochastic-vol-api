import { Link } from 'react-router-dom'
import { UncertaintyGroupsPanel } from '../components/UncertaintyGroupsPanel'
import { WorkflowGate } from '../components/WorkflowGate'

export function GroupWorkbenchPage() {
  return (
    <div>
      <p className="page-desc">
        Build uncertainty groups by parameter, segment, and reservoir before running dependency analysis.
      </p>
      <WorkflowGate>
        <div className="card classic-toolbar">
          <div className="classic-toolbar-row">
            <strong>Group builder</strong>
            <Link to="/dependency">Group matrix</Link>
            <Link to="/dependency/correlations">Open correlation matrix</Link>
          </div>
        </div>
        <UncertaintyGroupsPanel />
      </WorkflowGate>
    </div>
  )
}
