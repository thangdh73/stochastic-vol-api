import type { ReservoirItem, ReservoirSegment } from '../types/api'

export function tankId(segmentId: string, reservoirId: string): string {
  return `${segmentId}::${reservoirId}`
}

export function uniqueTankId(segmentName: string, reservoirName: string): string {
  return `${segmentName},${reservoirName}`
}

/** Tank code like R1-S1 using global segment and reservoir order. */
export function tankCode(
  reservoirIndex: number,
  segmentIndex: number,
): string {
  return `R${reservoirIndex + 1}-S${segmentIndex + 1}`
}

export function estimatingMethodShort(method: string | undefined): string {
  return method === 'nrv_grv_yield' ? 'NRV × HC Yield' : 'Area × NP × Yield'
}

export function buildTankRows(
  reservoirs: ReservoirItem[],
  segments: ReservoirSegment[],
  getMethod: (segmentId: string, reservoirId: string) => string | undefined,
): Array<{
  tankId: string
  uniqueId: string
  segmentIndex: number
  reservoirIndex: number
  segmentId: string
  tankCode: string
  reservoirName: string
  segmentName: string
  method: string
  reservoirId: string
}> {
  const rows: Array<{
    tankId: string
    uniqueId: string
    segmentIndex: number
    reservoirIndex: number
    segmentId: string
    tankCode: string
    reservoirName: string
    segmentName: string
    method: string
    reservoirId: string
  }> = []

  segments.forEach((seg, segmentIndex) => {
    reservoirs.forEach((res, reservoirIndex) => {
      rows.push({
        tankId: tankId(seg.id, res.id),
        uniqueId: uniqueTankId(seg.name, res.name),
        segmentIndex,
        reservoirIndex,
        segmentId: seg.id,
        tankCode: tankCode(reservoirIndex, segmentIndex),
        reservoirName: res.name,
        segmentName: seg.name,
        method: estimatingMethodShort(getMethod(seg.id, res.id)),
        reservoirId: res.id,
      })
    })
  })
  return rows
}
