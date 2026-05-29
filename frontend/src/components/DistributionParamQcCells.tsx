import type { DistributionSpec } from '../types/api'
import { formatDistTypeShort, formatQcPercentile } from '../utils/distSummary'

type Props = {
  dist: DistributionSpec | null | undefined
  asPercent?: boolean
}

/** Read-only L / B / H cells for QC review (L=P90, B=P50, H=P10). */
export function DistributionParamQcCells({ dist, asPercent = false }: Props) {
  return (
    <>
      <td className="qc-cell qc-num">{formatQcPercentile(dist, 'L', asPercent)}</td>
      <td className="qc-cell qc-num qc-base">{formatQcPercentile(dist, 'B', asPercent)}</td>
      <td className="qc-cell qc-num">{formatQcPercentile(dist, 'H', asPercent)}</td>
      <td className="qc-cell qc-type" title={dist?.distribution_type ?? undefined}>
        {formatDistTypeShort(dist)}
      </td>
    </>
  )
}
