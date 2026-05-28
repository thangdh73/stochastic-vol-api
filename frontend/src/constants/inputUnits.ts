/** User-facing input units (canonical storage unchanged in engine). */

export type AreaInputUnit = 'acres' | 'sq_km'
export type RockVolumeInputUnit =
  | 'acre_ft'
  | 'thousand_acre_ft'
  | 'ft3'
  | 'm3'
  | 'thousand_ft3'
  | 'thousand_m3'
  | 'million_ft3'
  | 'million_m3'

export const AREA_INPUT_UNITS: { id: AreaInputUnit; label: string }[] = [
  { id: 'acres', label: 'Acres' },
  { id: 'sq_km', label: 'Square km (sq km)' },
]

export const ROCK_VOLUME_INPUT_UNITS: { id: RockVolumeInputUnit; label: string }[] = [
  { id: 'acre_ft', label: 'Acre-ft' },
  { id: 'thousand_acre_ft', label: 'Thousand acre-ft (×10³ acre-ft)' },
  { id: 'ft3', label: 'Cubic feet (ft³)' },
  { id: 'm3', label: 'Cubic metres (m³)' },
  { id: 'thousand_ft3', label: 'Thousand cubic feet (×10³ ft³)' },
  { id: 'thousand_m3', label: 'Thousand cubic metres (×10³ m³)' },
  { id: 'million_ft3', label: 'Million cubic feet (×10⁶ ft³)' },
  { id: 'million_m3', label: 'Million cubic metres (×10⁶ m³)' },
]

export function areaInputUnitLabel(unit: AreaInputUnit | undefined): string {
  return AREA_INPUT_UNITS.find((u) => u.id === unit)?.label ?? 'Acres'
}

export function rockVolumeInputUnitLabel(unit: RockVolumeInputUnit | undefined): string {
  return ROCK_VOLUME_INPUT_UNITS.find((u) => u.id === unit)?.label ?? 'Acre-ft'
}
