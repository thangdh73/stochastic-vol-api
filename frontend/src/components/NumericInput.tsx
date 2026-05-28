import {
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from 'react'
import {
  finalizeNumericInput,
  isAllowedNumericTyping,
  parseNumericInput,
} from '../utils/numericInput'

type NumericInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> & {
  value: number | null | undefined
  onChange: (value: number | null) => void
  /** Display/store as percent (UI shows 17.8, value 0.178). */
  asPercent?: boolean
  /** Allow clearing to null; if false, empty reverts on blur. */
  allowEmpty?: boolean
}

function formatDisplay(
  v: number | null | undefined,
  asPercent: boolean,
): string {
  if (v == null) return ''
  const n = asPercent ? v * 100 : v
  if (!Number.isFinite(n)) return ''
  const rounded = Math.round(n * 1e12) / 1e12
  return String(rounded)
}

function parseDisplay(raw: string, asPercent: boolean, finalize = false): number | null {
  const n = finalize ? finalizeNumericInput(raw) : parseNumericInput(raw)
  if (n == null) return null
  return asPercent ? n / 100 : n
}

/**
 * Decimal text input — updates parent only on blur or Enter, not each keystroke.
 */
export function NumericInput({
  value,
  onChange,
  asPercent = false,
  allowEmpty = true,
  onBlur,
  onFocus,
  onKeyDown,
  ...rest
}: NumericInputProps) {
  const [text, setText] = useState(() => formatDisplay(value, asPercent))
  const focused = useRef(false)
  const lastExternal = useRef(value)

  useEffect(() => {
    if (focused.current) return
    if (Object.is(value, lastExternal.current)) return
    lastExternal.current = value
    setText(formatDisplay(value, asPercent))
  }, [value, asPercent])

  const commitToParent = (raw: string, finalize: boolean) => {
    const trimmed = raw.trim()
    if (trimmed === '') {
      if (allowEmpty) {
        onChange(null)
        lastExternal.current = null
        setText('')
      } else {
        setText(formatDisplay(value, asPercent))
      }
      return
    }
    const parsed = parseDisplay(raw, asPercent, finalize)
    if (parsed === null) {
      setText(formatDisplay(value, asPercent))
      return
    }
    onChange(parsed)
    lastExternal.current = parsed
    setText(formatDisplay(parsed, asPercent))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitToParent(text, true)
      e.currentTarget.blur()
    }
    onKeyDown?.(e)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onFocus={(e) => {
        focused.current = true
        onFocus?.(e)
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(',', '.')
        if (!isAllowedNumericTyping(raw)) return
        setText(raw)
      }}
      onKeyDown={handleKeyDown}
      onBlur={(e) => {
        focused.current = false
        commitToParent(text, true)
        onBlur?.(e)
      }}
      {...rest}
    />
  )
}
