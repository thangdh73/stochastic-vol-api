/** Characters allowed while typing (optional leading minus, one decimal point). */
export function isAllowedNumericTyping(raw: string): boolean {
  if (raw === '') return true
  return /^-?\d*\.?\d*$/.test(raw)
}

/** True while the user is still typing a valid incomplete number (e.g. "12.", "-"). */
export function isPartialNumericInput(raw: string): boolean {
  const t = raw.trim().replace(',', '.')
  if (t === '' || t === '-' || t === '.' || t === '-.') return true
  return /^-?\d*\.?\d*$/.test(t) && (t.endsWith('.') || t === '-')
}

/** Parse a complete numeric string; returns null for empty or incomplete input. */
export function parseNumericInput(raw: string): number | null {
  const t = raw.trim().replace(',', '.')
  if (t === '' || t === '-' || t === '.' || t === '-.') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Parse on blur — treats trailing "." as finished (e.g. "12." → 12). */
export function finalizeNumericInput(raw: string): number | null {
  let t = raw.trim().replace(',', '.')
  if (t === '' || t === '-' || t === '.' || t === '-.') return null
  if (t.endsWith('.')) t = t.slice(0, -1)
  if (t === '' || t === '-') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
