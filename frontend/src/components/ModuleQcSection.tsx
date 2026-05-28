import { InputQcCharts } from './charts/InputQcCharts'
import { ModuleSimulationButton } from './ModuleSimulationButton'
import { ModuleSummariesCard } from './ModuleSummariesCard'
import { useWorkflow } from '../context/WorkflowContext'
import type { RockVolumeInputUnit } from '../constants/inputUnits'
import type { ModuleScope, SimulationArrays } from '../types/api'

interface ModuleQcSectionProps {
  scope: ModuleScope
  title: string
  hint?: string
  rockVolumeUnit?: RockVolumeInputUnit
  statusNote?: string | null
}

export function ModuleQcSection({
  scope,
  title,
  hint,
  rockVolumeUnit,
  statusNote,
}: ModuleQcSectionProps) {
  const { getModulePreview, loading } = useWorkflow()
  const preview = getModulePreview(scope)
  const arrays = preview?.arrays
  const hasCharts = Boolean(arrays && Object.keys(arrays).length > 0)

  return (
    <div className="card">
      <div className="card-header-row">
        <h2>{title}</h2>
        <div className="btn-row" style={{ margin: 0 }}>
          <ModuleSimulationButton scope={scope} className="primary" />
        </div>
      </div>
      {statusNote && (
        <p className={`alert ${statusNote.includes('disabled while') ? 'warn' : 'info'}`}>
          {statusNote}
        </p>
      )}
      {!hasCharts ? (
        <p className="alert info">
          {hint ??
            `Click Run simulation above to sample ${scope.replace('_', ' ')} inputs for this tab only.`}
        </p>
      ) : (
        <>
          {preview && (
            <ModuleSummariesCard preview={preview} rockVolumeUnit={rockVolumeUnit} />
          )}
          <InputQcCharts
            arrays={arrays as SimulationArrays}
            rockVolumeUnit={rockVolumeUnit}
          />
        </>
      )}
      {loading && hasCharts && (
        <p className="convention-inline">Updating…</p>
      )}
    </div>
  )
}
