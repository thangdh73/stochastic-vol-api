import { describe, expect, it } from 'vitest'
import { createDefaultInput } from './defaultInput'
import {
  applyGasUnitSelectToInput,
  applyOilUnitSelectToInput,
  assertUniqueGasUnitSelectIds,
  assertUniqueGrvUnitValues,
  assertUniqueOilUnitSelectIds,
  GIIP_UNIT_SELECT_OPTIONS,
  GRV_UNIT_SELECT_OPTIONS,
  resolveGasUnitSelectId,
  resolveOilUnitSelectId,
  STOIIP_UNIT_SELECT_OPTIONS,
} from './setupUnits'

describe('setupUnits', () => {
  it('has unique gas, oil, and GRV option keys', () => {
    expect(() => assertUniqueGasUnitSelectIds()).not.toThrow()
    expect(() => assertUniqueOilUnitSelectIds()).not.toThrow()
    expect(() => assertUniqueGrvUnitValues()).not.toThrow()
  })

  it('keeps MMcf and Mcf as distinct select ids (same engine unit)', () => {
    const mcf = GIIP_UNIT_SELECT_OPTIONS.find((o) => o.displayLabel === 'Mcf')
    const mmcf = GIIP_UNIT_SELECT_OPTIONS.find((o) => o.displayLabel === 'MMcf')
    expect(mcf?.id).toBe('gas_mmscf_mcf')
    expect(mmcf?.id).toBe('gas_mmscf_mmcf')
    expect(mcf?.id).not.toBe(mmcf?.id)
    expect(mcf?.unit).toBe('MMSCF')
    expect(mmcf?.unit).toBe('MMSCF')
  })

  it('resolves and round-trips gas MMcf vs Mcf preference', () => {
    expect(resolveGasUnitSelectId('gas_mmscf_mmcf', 'MMSCF')).toBe('gas_mmscf_mmcf')
    expect(resolveGasUnitSelectId('gas_mmscf_mcf', 'MMSCF')).toBe('gas_mmscf_mcf')
    expect(resolveGasUnitSelectId(undefined, 'MMSCF')).toBe('gas_mmscf_mmcf')
  })

  it('applies each GIIP option to engine gas_resource_unit', () => {
    const base = createDefaultInput()
    for (const opt of GIIP_UNIT_SELECT_OPTIONS) {
      const next = applyGasUnitSelectToInput(base, opt.id)
      expect(next.gas_resource_unit).toBe(opt.unit)
    }
  })

  it('applies each STOIIP option to engine oil_resource_unit', () => {
    const base = createDefaultInput()
    for (const opt of STOIIP_UNIT_SELECT_OPTIONS) {
      const next = applyOilUnitSelectToInput(base, opt.id)
      expect(next.oil_resource_unit).toBe(opt.unit)
    }
  })

  it('resolves oil display variants (MMbbl vs Mbbl)', () => {
    expect(resolveOilUnitSelectId('oil_mmbo_mmbbl', 'MMBO')).toBe('oil_mmbo_mmbbl')
    expect(resolveOilUnitSelectId('oil_mmbo_mbbl', 'MMBO')).toBe('oil_mmbo_mbbl')
    expect(resolveOilUnitSelectId(undefined, 'MMSTB')).toBe('oil_mmstb_bbl')
  })

  it('lists every GRV unit with a unique value', () => {
    expect(GRV_UNIT_SELECT_OPTIONS.length).toBe(6)
    const values = GRV_UNIT_SELECT_OPTIONS.map((o) => o.value)
    expect(new Set(values).size).toBe(values.length)
  })
})
