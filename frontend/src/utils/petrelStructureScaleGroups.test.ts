import { describe, expect, it } from 'vitest'
import {
  buildDefaultPetrelStructureScaleGroup,
  ensurePetrelStructureScaleGroups,
  hasPetrelStructureScaleGroup,
} from './petrelStructureScaleGroups'

describe('petrelStructureScaleGroups', () => {
  const segments = [
    { id: 's1', name: 'Deposit 1A', type: 'geobody' as const },
    { id: 's2', name: 'Deposit 1B', type: 'geobody' as const },
  ]
  const reservoirs = [{ id: 'r1', name: 'UMA1015', enabled: true, shared_simulation: false }]

  it('adds default all-segment structure scale group', () => {
    const next = ensurePetrelStructureScaleGroups([], segments, reservoirs)
    expect(next).toHaveLength(1)
    expect(next[0].parameter).toBe('petrel_structure_scale')
    expect(next[0].name).toBe('StructureScale_UMA1015_All')
    expect(next[0].all_segments).toBe(true)
    expect(next[0].all_reservoirs).toBe(true)
  })

  it('does not duplicate when group already exists', () => {
    const existing = [buildDefaultPetrelStructureScaleGroup(segments, reservoirs)]
    const next = ensurePetrelStructureScaleGroups(existing, segments, reservoirs)
    expect(next).toHaveLength(1)
    expect(hasPetrelStructureScaleGroup(next)).toBe(true)
  })
})
