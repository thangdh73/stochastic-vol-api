export type ComplexTrapHelpKey = 'A-1' | 'A-2' | 'B-1' | 'B-2'

export interface ComplexTrapHelpSlide {
  key: ComplexTrapHelpKey
  title: string
  method: 'A' | 'B'
  elements: 1 | 2
  imageSrc: string
  summary: string[]
}

export const COMPLEX_TRAP_HELP_SLIDES: ComplexTrapHelpSlide[] = [
  {
    key: 'A-1',
    title: 'Complex Trap – Method A, 1 Element',
    method: 'A',
    elements: 1,
    imageSrc: '/help/complex-trap-method-a-1.png',
    summary: [
      'Updip reference = closed area (Area) or GRV sample (NRV) before trap fill × NTG.',
      'Element 1 cap is a percentile anchor on the non–complex-trap distribution.',
      'If Fault 1 fails to seal (random > P(seal)): volume is log-rescaled to the element 1 cap.',
      'If Fault 1 seals: the original sample is kept (full trap envelope).',
    ],
  },
  {
    key: 'A-2',
    title: 'Complex Trap – Method A, 2 Elements',
    method: 'A',
    elements: 2,
    imageSrc: '/help/complex-trap-method-a-2.png',
    summary: [
      'Adds a second downdip element (Fault 2) with seal confidence P(b).',
      'Both seal: keep the original sample (largest envelope).',
      'Fault 1 seals, Fault 2 fails: log-rescale to element 2 cap (intermediate).',
      'Fault 1 fails: log-rescale to element 1 cap (updip / smallest).',
    ],
  },
  {
    key: 'B-1',
    title: 'Complex Trap – Method B, 1 Element',
    method: 'B',
    elements: 1,
    imageSrc: '/help/complex-trap-method-b-1.png',
    summary: [
      'Area workflow only in the reference workbook (not used on NRV).',
      'If sampled area > element 1 max and Fault 1 fails to seal: cap at element 1 max exactly.',
      'Otherwise the sample is unchanged.',
    ],
  },
  {
    key: 'B-2',
    title: 'Complex Trap – Method B, 2 Elements',
    method: 'B',
    elements: 2,
    imageSrc: '/help/complex-trap-method-b-2.png',
    summary: [
      'Area workflow only. Nested caps when samples exceed element maxima.',
      'Fault 1 fail → cap at element 1; Fault 1 seal + Fault 2 fail → cap at element 2.',
      'Both seal: sample unchanged.',
    ],
  },
]

export function helpKeyFor(method: 'A' | 'B', elements: number): ComplexTrapHelpKey {
  const n = elements >= 2 ? 2 : 1
  return `${method}-${n}` as ComplexTrapHelpKey
}

export function slideForKey(key: ComplexTrapHelpKey): ComplexTrapHelpSlide {
  return COMPLEX_TRAP_HELP_SLIDES.find((s) => s.key === key) ?? COMPLEX_TRAP_HELP_SLIDES[0]
}
