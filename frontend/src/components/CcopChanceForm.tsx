import { defaultCcopRisk } from '../constants/ccopChance'
import type { CcopRiskCommentKey, CcopRiskSpec } from '../constants/ccopChance'
import { CcopDescriptorSelect } from './CcopDescriptorSelect'

interface CcopChanceFormProps {
  value: CcopRiskSpec
  onChange: (next: CcopRiskSpec) => void
}

export function CcopChanceForm({ value, onChange }: CcopChanceFormProps) {
  const patch = (partial: Partial<CcopRiskSpec>) => onChange({ ...value, ...partial })

  const setComment = (key: CcopRiskCommentKey, text: string) => {
    const comments = { ...(value.comments ?? {}) }
    if (text === '') {
      delete comments[key]
    } else {
      comments[key] = text
    }
    patch({ comments: Object.keys(comments).length ? comments : undefined })
  }

  const comment = (key: CcopRiskCommentKey) => value.comments?.[key] ?? ''

  return (
    <div>
      <div className="alert info" role="note">
        <strong>CCOP (2000)</strong> Pg = P<sub>reservoir</sub> × P<sub>trap</sub> × P<sub>charge</sub> ×{' '}
        P<sub>retention</sub>. Pick a probability band from each dropdown, add rationale notes, then{' '}
        <strong>Run Chance simulation</strong> below for Pg and the risk review table (used in Monte
        Carlo results).
      </div>

      <div className="card">
        <h2>Reservoir (P1)</h2>
        <CcopDescriptorSelect
          factorKey="reservoir_presence"
          label="P1a — Facies presence"
          p={value.reservoir.facies_presence}
          onChange={(p) =>
            patch({ reservoir: { ...value.reservoir, facies_presence: p } })
          }
          comment={comment('reservoir_presence')}
          onCommentChange={(t) => setComment('reservoir_presence', t)}
        />
        <CcopDescriptorSelect
          factorKey="reservoir_effectiveness"
          label="P1b — Effectiveness (φ, k, Sw)"
          p={value.reservoir.effectiveness}
          onChange={(p) =>
            patch({ reservoir: { ...value.reservoir, effectiveness: p } })
          }
          comment={comment('reservoir_effectiveness')}
          onCommentChange={(t) => setComment('reservoir_effectiveness', t)}
        />
      </div>

      <div className="card">
        <h2>Trap (P2)</h2>
        <CcopDescriptorSelect
          factorKey="trap_structure"
          label="P2a — Structure / closure"
          p={value.trap.structure}
          onChange={(p) => patch({ trap: { ...value.trap, structure: p } })}
          comment={comment('trap_structure')}
          onCommentChange={(t) => setComment('trap_structure', t)}
        />
        <CcopDescriptorSelect
          factorKey="seal_top"
          label="P2b — Top seal"
          p={value.trap.seal_top ?? 1}
          onChange={(p) => patch({ trap: { ...value.trap, seal_top: p } })}
          comment={comment('seal_top')}
          onCommentChange={(t) => setComment('seal_top', t)}
        />
        <CcopDescriptorSelect
          factorKey="seal_lateral"
          label="P2b — Lateral (fault) seal (optional)"
          p={value.trap.seal_lateral ?? 1}
          onChange={(p) => patch({ trap: { ...value.trap, seal_lateral: p } })}
          comment={comment('seal_lateral')}
          onCommentChange={(t) => setComment('seal_lateral', t)}
        />
      </div>

      <div className="card">
        <h2>Charge (P3)</h2>
        <CcopDescriptorSelect
          factorKey="source"
          label="Mature source A"
          p={value.charge.sources[0] ?? 0.7}
          onChange={(p) => {
            const sources = [...value.charge.sources]
            sources[0] = p
            patch({ charge: { ...value.charge, sources } })
          }}
          comment={comment('source_a')}
          onCommentChange={(t) => setComment('source_a', t)}
        />
        {value.charge.sources.length > 1 ? (
          <>
            <CcopDescriptorSelect
              factorKey="source"
              label="Mature source B (OR-combined)"
              p={value.charge.sources[1] ?? 0.7}
              onChange={(p) => {
                const sources = [value.charge.sources[0] ?? 0.7, p]
                patch({ charge: { ...value.charge, sources } })
              }}
              comment={comment('source_b')}
              onCommentChange={(t) => setComment('source_b', t)}
            />
            <label className="ccop-comment-field">
              Combined source — rationale (optional)
              <textarea
                rows={2}
                spellCheck
                placeholder="e.g. OR — either kitchen sufficient for charge"
                value={comment('source_combined')}
                onChange={(e) => setComment('source_combined', e.target.value)}
              />
            </label>
          </>
        ) : (
          <button
            type="button"
            className="btn secondary"
            style={{ marginBottom: '0.75rem' }}
            onClick={() =>
              patch({
                charge: {
                  ...value.charge,
                  sources: [...value.charge.sources, 0.6],
                },
              })
            }
          >
            + Add second source (OR combination)
          </button>
        )}
        <CcopDescriptorSelect
          factorKey="migration"
          label="Migration & timing"
          p={value.charge.migration}
          onChange={(p) => patch({ charge: { ...value.charge, migration: p } })}
          comment={comment('migration')}
          onCommentChange={(t) => setComment('migration', t)}
        />
      </div>

      <div className="card">
        <h2>Retention (P4)</h2>
        <CcopDescriptorSelect
          factorKey="retention"
          label="Post-accumulation retention"
          p={value.retention}
          onChange={(p) => patch({ retention: p })}
          comment={comment('retention')}
          onCommentChange={(t) => setComment('retention', t)}
        />
        <button
          type="button"
          className="btn secondary"
          style={{ marginTop: '0.5rem' }}
          onClick={() => onChange(defaultCcopRisk())}
        >
          Reset to CCOP starter (Tiram-like)
        </button>
      </div>
    </div>
  )
}
