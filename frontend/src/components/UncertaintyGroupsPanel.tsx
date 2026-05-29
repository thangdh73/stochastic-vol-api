import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkflow } from '../context/WorkflowContext'
import type { UncertaintyParameterGroup, UncertaintyParameterId } from '../types/uncertaintyGroups'
import {
  findMembershipConflicts,
  formatReservoirScope,
  formatSegmentScope,
  membersFromSelection,
  newGroupId,
  selectionFromGroup,
  suggestGroupName,
  UNCERTAINTY_PARAMETER_LABELS,
  UNCERTAINTY_PARAMETER_OPTIONS,
} from '../utils/uncertaintyGroups'

type EditorState = {
  id: string
  name: string
  parameter: UncertaintyParameterId
  segmentIds: string[]
  reservoirIds: string[]
  allSegments: boolean
  allReservoirs: boolean
  notes: string
}

function emptyEditor(): EditorState {
  return {
    id: newGroupId(),
    name: '',
    parameter: 'porosity',
    segmentIds: [],
    reservoirIds: [],
    allSegments: false,
    allReservoirs: false,
    notes: '',
  }
}

export function UncertaintyGroupsPanel({ compact = false }: { compact?: boolean }) {
  const {
    segments,
    reservoirs,
    getTankInput,
    uncertaintyGroups,
    saveUncertaintyGroup,
    removeUncertaintyGroup,
    loadExampleUncertaintyGroups,
  } = useWorkflow()

  const hasPetrelGrvTanks = useMemo(() => {
    for (const s of segments) {
      for (const r of reservoirs) {
        const t = getTankInput(s.id, r.id)
        if (t?.nrv_entry_mode === 'petrel_marginals') return true
      }
    }
    return false
  }, [segments, reservoirs, getTankInput])

  const [editor, setEditor] = useState<EditorState | null>(null)
  const [nameTouched, setNameTouched] = useState(false)

  const canLoadExample = reservoirs.length >= 1 && segments.length >= 3

  const editorConflicts = useMemo(() => {
    if (!editor) return []
    const { members, all_segments, all_reservoirs } = membersFromSelection(
      editor.segmentIds,
      editor.reservoirIds,
      editor.allSegments,
      editor.allReservoirs,
    )
    const draft: UncertaintyParameterGroup = {
      id: editor.id,
      name: editor.name || 'draft',
      parameter: editor.parameter,
      members,
      all_segments,
      all_reservoirs,
      notes: editor.notes,
    }
    return findMembershipConflicts(draft, uncertaintyGroups, segments, reservoirs)
  }, [editor, uncertaintyGroups, segments, reservoirs])

  const openNew = () => {
    const firstSeg = segments[0]?.id
    const firstRes = reservoirs[0]?.id
    setEditor({
      ...emptyEditor(),
      segmentIds: firstSeg ? [firstSeg] : [],
      reservoirIds: firstRes ? [firstRes] : [],
    })
    setNameTouched(false)
  }

  const openEdit = (group: UncertaintyParameterGroup) => {
    const sel = selectionFromGroup(group, segments, reservoirs)
    setEditor({
      id: group.id,
      name: group.name,
      parameter: group.parameter,
      segmentIds: sel.segmentIds,
      reservoirIds: sel.reservoirIds,
      allSegments: sel.allSegments,
      allReservoirs: sel.allReservoirs,
      notes: group.notes ?? '',
    })
    setNameTouched(true)
  }

  const toggleId = (ids: string[], id: string): string[] =>
    ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]

  const autoName = (): string => {
    if (!editor) return ''
    const segNames = segments
      .filter((s) => editor.allSegments || editor.segmentIds.includes(s.id))
      .map((s) => s.name)
    const resNames = reservoirs
      .filter((r) => editor.allReservoirs || editor.reservoirIds.includes(r.id))
      .map((r) => r.name)
    return suggestGroupName(
      editor.parameter,
      segNames,
      resNames,
      editor.allSegments,
      editor.allReservoirs,
    )
  }

  const saveEditor = () => {
    if (!editor) return
    if (editorConflicts.length) return
    const { members, all_segments, all_reservoirs } = membersFromSelection(
      editor.segmentIds,
      editor.reservoirIds,
      editor.allSegments,
      editor.allReservoirs,
    )
    if (!all_segments && !all_reservoirs && members.length === 0) return

    const group: UncertaintyParameterGroup = {
      id: editor.id,
      name: (editor.name.trim() || autoName()).trim(),
      parameter: editor.parameter,
      members,
      all_segments,
      all_reservoirs,
      notes: editor.notes.trim() || undefined,
    }
    saveUncertaintyGroup(group)
    setEditor(null)
  }

  return (
    <div className="card">
      <div className="card-header-row">
        <h2 style={{ margin: 0 }}>Uncertainty parameter groups</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canLoadExample && (
            <button
              type="button"
              className="btn-secondary"
              onClick={loadExampleUncertaintyGroups}
            >
              Load example (GRV + Poro/Sw compartments)
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={openNew}>
            Add group
          </button>
        </div>
      </div>

      {!compact && (
        <>
          <p className="convention-inline">
            Define <strong>named drivers</strong> for uncertainty and tornado charts (e.g.{' '}
            <code>Poro_R1_S1,2</code> vs <code>Poro_R1_S3</code> for diagenesis). Each tank can
            belong to <strong>one group per parameter</strong>. Set correlations between groups on
            the <Link to="/dependency/correlations">Correlations</Link> tab.
          </p>
          {hasPetrelGrvTanks ? (
            <p className="convention-inline">
              <strong>Petrel GRV (3+3):</strong> use{' '}
              <strong>{UNCERTAINTY_PARAMETER_LABELS.petrel_grv_depth}</strong> and{' '}
              <strong>{UNCERTAINTY_PARAMETER_LABELS.petrel_grv_contact}</strong> instead of generic{' '}
              GRV — they match the depth and fluid-contact cases entered on Rock volume.
            </p>
          ) : null}
          <details className="dependency-param-ref" style={{ marginTop: '0.5rem' }}>
            <summary>Parameter list (all drivers)</summary>
            <ul className="dependency-param-ref-list">
              {UNCERTAINTY_PARAMETER_OPTIONS.map((p) => (
                <li key={p}>
                  <code>{p}</code> — {UNCERTAINTY_PARAMETER_LABELS[p]}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}

      {uncertaintyGroups.length === 0 ? (
        <p className="alert warn">
          No groups defined. Use <strong>Add group</strong> or load the example when you have at
          least three segments. Legacy <strong>Corr↔Seg</strong> checkboxes below still copy
          per-tank matrices.
        </p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Group</th>
              <th>Parameter</th>
              <th>Segments</th>
              <th>Reservoirs</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {uncertaintyGroups.map((g) => (
              <tr key={g.id}>
                <td>
                  <strong>{g.name}</strong>
                  {g.notes ? (
                    <div className="muted" style={{ fontSize: '0.85rem' }}>
                      {g.notes}
                    </div>
                  ) : null}
                </td>
                <td>{UNCERTAINTY_PARAMETER_LABELS[g.parameter]}</td>
                <td>{formatSegmentScope(g, segments)}</td>
                <td>{formatReservoirScope(g, reservoirs)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    title="Edit"
                    onClick={() => openEdit(g)}
                  >
                    Edit
                  </button>{' '}
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ color: 'var(--danger, #c00)' }}
                    title="Delete"
                    onClick={() => removeUncertaintyGroup(g.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editor && (
        <div className="card" style={{ marginTop: '1rem', background: 'var(--surface-2, #f8f9fa)' }}>
          <h3 style={{ marginTop: 0 }}>{uncertaintyGroups.some((g) => g.id === editor.id) ? 'Edit group' : 'New group'}</h3>
          <div className="form-grid">
            <label>
              Group name
              <input
                type="text"
                value={editor.name}
                placeholder={autoName()}
                onChange={(e) => {
                  setNameTouched(true)
                  setEditor({ ...editor, name: e.target.value })
                }}
                onBlur={() => {
                  if (!nameTouched && !editor.name.trim()) {
                    setEditor({ ...editor, name: autoName() })
                  }
                }}
              />
            </label>
            <label>
              Parameter
              <select
                value={editor.parameter}
                onChange={(e) => {
                  const parameter = e.target.value as UncertaintyParameterId
                  setEditor({
                    ...editor,
                    parameter,
                    name: nameTouched ? editor.name : suggestGroupName(
                      parameter,
                      segments.filter((s) => editor.allSegments || editor.segmentIds.includes(s.id)).map((s) => s.name),
                      reservoirs.filter((r) => editor.allReservoirs || editor.reservoirIds.includes(r.id)).map((r) => r.name),
                      editor.allSegments,
                      editor.allReservoirs,
                    ),
                  })
                }}
              >
                {UNCERTAINTY_PARAMETER_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {UNCERTAINTY_PARAMETER_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
            <div>
              <p className="convention-inline" style={{ marginTop: 0 }}>
                <strong>Segments</strong>
              </p>
              <label className="radio-row">
                <input
                  type="checkbox"
                  checked={editor.allSegments}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      allSegments: e.target.checked,
                      segmentIds: e.target.checked ? segments.map((s) => s.id) : editor.segmentIds,
                    })
                  }
                />
                All segments
              </label>
              {!editor.allSegments &&
                segments.map((s) => (
                  <label key={s.id} className="radio-row">
                    <input
                      type="checkbox"
                      checked={editor.segmentIds.includes(s.id)}
                      onChange={() =>
                        setEditor({
                          ...editor,
                          segmentIds: toggleId(editor.segmentIds, s.id),
                        })
                      }
                    />
                    {s.name}
                  </label>
                ))}
            </div>
            <div>
              <p className="convention-inline" style={{ marginTop: 0 }}>
                <strong>Reservoirs</strong>
              </p>
              <label className="radio-row">
                <input
                  type="checkbox"
                  checked={editor.allReservoirs}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      allReservoirs: e.target.checked,
                      reservoirIds: e.target.checked
                        ? reservoirs.map((r) => r.id)
                        : editor.reservoirIds,
                    })
                  }
                />
                All reservoirs
              </label>
              {!editor.allReservoirs &&
                reservoirs.map((r) => (
                  <label key={r.id} className="radio-row">
                    <input
                      type="checkbox"
                      checked={editor.reservoirIds.includes(r.id)}
                      onChange={() =>
                        setEditor({
                          ...editor,
                          reservoirIds: toggleId(editor.reservoirIds, r.id),
                        })
                      }
                    />
                    {r.name}
                  </label>
                ))}
            </div>
          </div>

          <label className="span-2" style={{ display: 'block', marginTop: '0.75rem' }}>
            Notes (optional)
            <input
              type="text"
              value={editor.notes}
              onChange={(e) => setEditor({ ...editor, notes: e.target.value })}
              placeholder="e.g. shared sand facies; diagenesis compartment"
            />
          </label>

          {editorConflicts.length > 0 && (
            <p className="alert warn">
              Overlap with existing group{' '}
              <strong>{editorConflicts[0].groupName}</strong> on the same parameter for this
              tank.
            </p>
          )}

          <div className="btn-row" style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className="primary"
              disabled={editorConflicts.length > 0}
              onClick={saveEditor}
            >
              Save group
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditor(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
