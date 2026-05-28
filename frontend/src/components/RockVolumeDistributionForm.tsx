import { useEffect, useRef, useState } from 'react'
import { DistributionInputCard } from './DistributionInputCard'
import type { DistributionSpec } from '../types/api'
import type { RockVolumeInputUnit } from '../constants/inputUnits'
import {
  rockVolumeDistToCanonical,
  rockVolumeDistToDisplay,
} from '../utils/rockVolumeUnits'

interface RockVolumeDistributionFormProps {
  /** Engine-canonical rock volume (acre-ft). */
  canonicalDist: DistributionSpec
  displayUnit: RockVolumeInputUnit
  onCommit: (canonicalDist: DistributionSpec) => void
  helperText?: string
}

function toDisplay(dist: DistributionSpec, unit: RockVolumeInputUnit): DistributionSpec {
  return rockVolumeDistToDisplay(dist, unit)
}

/** Local draft so unit conversion does not run on every keystroke. */
export function RockVolumeDistributionForm({
  canonicalDist,
  displayUnit,
  onCommit,
  helperText,
}: RockVolumeDistributionFormProps) {
  const [draft, setDraft] = useState(() => toDisplay(canonicalDist, displayUnit))
  const editing = useRef(false)

  useEffect(() => {
    if (editing.current) return
    setDraft(toDisplay(canonicalDist, displayUnit))
  }, [canonicalDist, displayUnit])

  const flush = (dist: DistributionSpec) => {
    onCommit(rockVolumeDistToCanonical(dist, displayUnit))
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
      <DistributionInputCard dist={draft} onChange={setDraft} helperText={helperText} />
    </div>
  )
}
