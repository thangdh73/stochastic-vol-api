import { Link } from 'react-router-dom'
import { GroupCorrelationMatrixGrid } from './GroupCorrelationMatrixGrid'
import { useWorkflow } from '../context/WorkflowContext'
import type { GroupCorrelationMode } from '../types/uncertaintyGroups'

function groupCorrelationActive(mode: GroupCorrelationMode): boolean {
  return mode === 'rank' || mode === 'gaussian_copula'
}

export function GroupDependencySection() {
  const {
    uncertaintyGroups,
    groupCorrelationMatrix,
    groupCorrelationMode,
    setGroupCorrelationMode,
    setGroupMatrixCell,
  } = useWorkflow()

  const mode = groupCorrelationMode
  const matrixEnabled = groupCorrelationActive(mode)
  const hasGroups = uncertaintyGroups.length > 0

  if (!hasGroups) {
    return (
      <div className="ntg-sharing-panel">
        <p className="convention-inline" style={{ margin: 0 }}>
          <strong>Group dependencies:</strong> Define uncertainty groups in{' '}
          <Link to="/dependency/groups">Dependency → Groups</Link> (e.g.{' '}
          <code>Poro_R1_S1,2</code> vs <code>Poro_R1_S3</code>). The matrix below links those
          groups for Monte Carlo (e.g. Porosity ↔ Sw within a compartment). Until groups exist,
          use per-tank correlations or legacy <strong>Corr↔Seg</strong> flags in Prospect Setup.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="card">
        <h2>Prospect sampling mode (groups)</h2>
        <p className="convention-inline">
          Applies to <strong>{uncertaintyGroups.length}</strong> uncertainty group(s) across all
          tanks. Per-tank sampling below is used only when no group covers a parameter.
        </p>
        <label className="radio-row">
          <input
            type="radio"
            name="group-corr-mode"
            checked={mode === 'independent'}
            onChange={() => setGroupCorrelationMode('independent')}
          />
          Independent — groups sample separately
        </label>
        <label className="radio-row">
          <input
            type="radio"
            name="group-corr-mode"
            checked={mode === 'rank'}
            onChange={() => setGroupCorrelationMode('rank')}
          />
          Rank correlation (Iman–Conover, Spearman ρ between groups)
        </label>
        <label className="radio-row">
          <input
            type="radio"
            name="group-corr-mode"
            checked={mode === 'gaussian_copula'}
            onChange={() => setGroupCorrelationMode('gaussian_copula')}
          />
          Gaussian copula (Pearson ρ on normal scores, between groups)
        </label>
      </div>

      {groupCorrelationMatrix && (
        <div className="card">
          <h2>Group correlation matrix</h2>
          <p className="convention-inline">
            Correlations are between <strong>named groups</strong> (not individual tanks). Example:{' '}
            <code>Poro_R1_S1,2</code> ↔ <code>Sw_R1_S1,2</code> = −0.8; cross-compartment cells
            stay 0. Diagonal is always 1. Engine rollout for group MC is pending — data is saved
            with the project.
          </p>
          <GroupCorrelationMatrixGrid
            matrix={groupCorrelationMatrix}
            groups={uncertaintyGroups}
            disabled={!matrixEnabled}
            onCellChange={setGroupMatrixCell}
          />
        </div>
      )}
    </>
  )
}
