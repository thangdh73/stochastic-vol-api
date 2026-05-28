export type OilResourceUnit = 'MMBO' | 'MMSTB' | 'MMscm'
export type GasResourceUnit = 'BCF' | 'MMSCF' | 'Bscm'
export type TotalResourceUnit = 'MMBOE'

export const OIL_RESOURCE_UNITS: { id: OilResourceUnit; label: string }[] = [
  { id: 'MMBO', label: 'MMBO (million barrels oil)' },
  { id: 'MMSTB', label: 'MMSTB (million stock-tank barrels)' },
  { id: 'MMscm', label: 'MMscm (million standard cubic metres, liquid)' },
]

export const GAS_RESOURCE_UNITS: { id: GasResourceUnit; label: string }[] = [
  { id: 'BCF', label: 'BCF (billion cubic feet)' },
  { id: 'MMSCF', label: 'MMSCF (million standard cubic feet)' },
  { id: 'Bscm', label: 'Bscm (billion standard cubic metres)' },
]

export const TOTAL_RESOURCE_UNITS: { id: TotalResourceUnit; label: string }[] = [
  { id: 'MMBOE', label: 'MMBOE (million barrels oil equivalent)' },
]
