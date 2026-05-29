import { useState } from 'react'
import { api } from '../api/client'
import { formatApiError } from '../api/errors'
import type { DistributionPreviewResponse, DistributionSpec, ValidationReport } from '../types/api'
import { DistributionHistogramModal } from './DistributionHistogramModal'

type Props = {
  dist: DistributionSpec
  parameterTitle: string
  nIterations: number
  seed: number
  asPercent?: boolean
  variableKind?: 'generic' | 'fraction' | 'positive_resource'
  className?: string
}

export function DistributionQcSimulateButton({
  dist,
  parameterTitle,
  nIterations,
  seed,
  asPercent = false,
  variableKind = 'generic',
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<DistributionPreviewResponse | null>(null)

  const runQc = async () => {
    setOpen(true)
    setLoading(true)
    setError(null)
    setPreview(null)
    try {
      const result = await api.simulateDistributionPreview(
        dist,
        nIterations,
        seed,
        variableKind,
      )
      if (result.validation.has_errors) {
        setError(`${parameterTitle} QC blocked: fix validation errors for this distribution.`)
        return
      }
      setPreview(result)
    } catch (e) {
      try {
        const parsed = JSON.parse(e instanceof Error ? e.message : String(e)) as {
          detail?: { validation?: ValidationReport; message?: string }
        }
        if (parsed.detail?.validation?.has_errors) {
          setError(
            parsed.detail.message ??
              `${parameterTitle} QC blocked: fix validation errors for this distribution.`,
          )
          return
        }
      } catch {
        /* ignore */
      }
      setError(formatApiError(e, `${parameterTitle} distribution QC`))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className={className ?? 'dist-qc-sim-btn'}
        onClick={runQc}
        disabled={loading}
        title={`Sample ${parameterTitle} only (${nIterations.toLocaleString()} iterations)`}
      >
        {loading ? 'Sampling…' : 'QC histogram'}
      </button>
      <DistributionHistogramModal
        open={open}
        onClose={() => setOpen(false)}
        title={parameterTitle}
        dist={dist}
        preview={preview}
        loading={loading}
        error={error}
        asPercent={asPercent}
      />
    </>
  )
}
