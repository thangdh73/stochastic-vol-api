import { useEffect, useRef, useState } from 'react'
import type { DistributionSpec } from '../types/api'
import { netPayDistToCanonicalFeet, netPayDistToDisplay, type NetPayDisplayUnit } from '../utils/netPayUnits'
import { DistributionInputCard } from './DistributionInputCard'

interface NetPayDistributionFormProps {
  /** Engine-canonical net pay dist (feet). */
  canonicalDist: DistributionSpec
  displayUnit: NetPayDisplayUnit
  onCommit: (canonicalDist: DistributionSpec) => void
}

/**
 * Local draft so metres↔feet conversion does not run on each keystroke.
 * Canonical state remains in feet.
 */
export function NetPayDistributionForm({
  canonicalDist,
  displayUnit,
  onCommit,
}: NetPayDistributionFormProps) {
  const [draft, setDraft] = useState(() => netPayDistToDisplay(canonicalDist, displayUnit))
  const editing = useRef(false)

  useEffect(() => {
    if (editing.current) return
    setDraft(netPayDistToDisplay(canonicalDist, displayUnit))
  }, [canonicalDist, displayUnit])

  const flush = (dist: DistributionSpec) => {
    onCommit(netPayDistToCanonicalFeet(dist, displayUnit))
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
      <DistributionInputCard dist={draft} onChange={setDraft} />
    </div>
  )
}

