import { useMemo, useState } from 'react'
import type { PetrelCumulativeGrvBlock, PetrelCumulativeSegmentRow, RockVolumeInputUnit } from '../types/api'
import { rockVolumeUnitLabel } from '../utils/rockVolumeUnits'
import {
  categoryLabels,
  incrementGrv,
  parseGrvPasteLine,
  rowGrvValid,
  scaledGrvPreview2p,
} from '../utils/petrelCumulativeGrv'
import { tankId } from '../utils/tankLabels'

type SegmentRow = { id: string; name: string; enabled?: boolean }
type ReservoirRow = { id: string; name: string; enabled?: boolean }

type Props = {
  block: PetrelCumulativeGrvBlock
  segments: SegmentRow[]
  reservoirs: ReservoirRow[]
  /** Retained for call-site compatibility; categories are fixed SPE 1P/2P/3P. */
  grvParamLabels?: string[]
  grvUnit: RockVolumeInputUnit
  onChange: (next: PetrelCumulativeGrvBlock) => void
}

function cellKey(segId: string, resId: string): string {
  return tankId(segId, resId)
}

export function PetrelCumulativeGrvMatrix({
  block,
  segments,
  reservoirs,
  grvUnit,
  onChange,
}: Props) {
  const [pasteText, setPasteText] = useState('')
  const [cat1, cat2, cat3] = categoryLabels()
  const unitLabel = rockVolumeUnitLabel(grvUnit)

  const rows = useMemo(() => {
    const out: Array<{ key: string; seg: SegmentRow; res: ReservoirRow; row: PetrelCumulativeSegmentRow }> = []
    for (const seg of segments) {
      for (const res of reservoirs) {
        if (res.enabled === false) continue
        const key = cellKey(seg.id, res.id)
        const row = block.segments[key] ?? {
          tank_key: key,
          grv_1p: 0,
          grv_2p: 0,
          grv_3p: 0,
          scale_low: 0.85,
          scale_mode: 1,
          scale_high: 1.17,
        }
        out.push({ key, seg, res, row })
      }
    }
    return out
  }, [block.segments, segments, reservoirs])

  const patchRow = (key: string, patch: Partial<PetrelCumulativeSegmentRow>) => {
    onChange({
      ...block,
      segments: {
        ...block.segments,
        [key]: { ...block.segments[key], tank_key: key, ...patch },
      },
    })
  }

  const applyPaste = () => {
    const lines = pasteText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (!lines.length) return
    const nextSegments = { ...block.segments }
    lines.forEach((line, i) => {
      const nums = parseGrvPasteLine(line)
      const target = rows[i]
      if (!nums || !target) return
      nextSegments[target.key] = {
        ...nextSegments[target.key],
        tank_key: target.key,
        grv_1p: nums[0],
        grv_2p: nums[1],
        grv_3p: nums[2],
      }
    })
    onChange({ ...block, segments: nextSegments })
    setPasteText('')
  }

  return (
    <div className="petrel-cumulative-panel card">
      <h3>Petrel cumulative GRV + structure scale</h3>
      <p className="page-desc">
        Enter Petrel cumulative GRV ({cat1}/{cat2}/{cat3}) per segment. Structure scale is
        triangular and linked field-wide (one shared percentile per MC iteration). HC yield uses{' '}
        <strong>GEF</strong> (scf/res ft³), not Bg — set on HC Yield tab.
      </p>

      <table className="data-table petrel-grv-input-table">
        <thead>
          <tr>
            <th>Segment</th>
            <th>{cat1} GRV</th>
            <th>{cat2} GRV</th>
            <th>{cat3} GRV</th>
            <th>Scale low</th>
            <th>Scale mode</th>
            <th>Scale high</th>
            <th>{cat2} scaled GRV</th>
            <th>Increments</th>
            <th>QC</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, seg, row }) => {
            const inc = incrementGrv(row)
            const preview = scaledGrvPreview2p(row)
            const valid = rowGrvValid(row)
            return (
              <tr key={key} className={seg.enabled === false ? 'row-disabled' : undefined}>
                <td>{seg.name}</td>
                {(['grv_1p', 'grv_2p', 'grv_3p'] as const).map((field) => (
                  <td key={field}>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={Number.isFinite(row[field]) ? row[field] : 0}
                      onChange={(e) => patchRow(key, { [field]: Number(e.target.value) })}
                    />
                  </td>
                ))}
                {(['scale_low', 'scale_mode', 'scale_high'] as const).map((field) => (
                  <td key={field}>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={row[field]}
                      onChange={(e) => patchRow(key, { [field]: Number(e.target.value) })}
                    />
                  </td>
                ))}
                <td className="petrel-preview-cell">
                  {preview.low.toFixed(1)} / {preview.mode.toFixed(1)} / {preview.high.toFixed(1)}
                </td>
                <td className="petrel-preview-cell">
                  {inc.p1_inc.toFixed(1)} / {inc.p2_inc.toFixed(1)} / {inc.p3_inc.toFixed(1)}
                </td>
                <td>{valid ? 'OK' : 'Fix'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="hint">GRV unit: {unitLabel}</p>

      <details className="input-details-panel">
        <summary>Paste GRV columns (3 values per line: {cat1}, {cat2}, {cat3})</summary>
        <textarea
          rows={5}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={`20, 30, 50\n15, 25, 40`}
        />
        <button type="button" onClick={applyPaste}>
          Apply paste to rows
        </button>
      </details>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={Boolean(block.independent_structure_scale)}
          onChange={(e) =>
            onChange({ ...block, independent_structure_scale: e.target.checked })
          }
        />
        Advanced: ignore structure-scale dependency groups (independent draw per segment)
      </label>
    </div>
  )
}
