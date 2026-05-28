import { useEffect, useRef, useState } from 'react'
import type { AreaChartUnit } from './charts/AreaWorkbookCharts'
import { DistributionInputCard } from './DistributionInputCard'
import type { DistributionSpec } from '../types/api'
import { areaDistToAcres, areaDistToSqKm } from '../utils/areaUnits'

interface AreaDistributionFormProps {
  /** Engine-canonical area dist (acres). */
  canonicalDist: DistributionSpec
  displayUnit: AreaChartUnit
  onCommit: (canonicalDist: DistributionSpec) => void
}

function toDisplay(dist: DistributionSpec, unit: AreaChartUnit): DistributionSpec {
  return unit === 'sq_km' ? areaDistToSqKm(dist) : dist
}

/**
 * Local draft for closed-area inputs so sq km ↔ acres conversion does not run
 * on every keystroke (only when the user leaves the field).
 */
export function AreaDistributionForm({
  canonicalDist,
  displayUnit,
  onCommit,
}: AreaDistributionFormProps) {
  const [draft, setDraft] = useState(() => toDisplay(canonicalDist, displayUnit))
  const editing = useRef(false)

  useEffect(() => {
    if (editing.current) return
    setDraft(toDisplay(canonicalDist, displayUnit))
  }, [canonicalDist, displayUnit])

  const flush = (dist: DistributionSpec) => {
    const canonical =
      displayUnit === 'sq_km' ? areaDistToAcres(dist) : dist
    onCommit(canonical)
  }

  return (
    <div
      onFocusCapture={() => {
        editing.current = true
      }}
      onBlurCapture={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        editing.current = false
        flush(draft)
      }}
    >
      <DistributionInputCard
        dist={draft}
        onChange={(d) => setDraft(d)}
      />
    </div>
  )
}
