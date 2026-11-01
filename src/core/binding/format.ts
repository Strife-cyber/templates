import type { Binding, FormatSpec } from '../schema/template'
import { resolvePath } from './paths'

/**
 * Value formatting for bindings. Locale is fixed to a neutral 'en-GB' for
 * dates and 'fr-FR'-style grouping for currency via explicit Intl options so
 * results are deterministic in tests and PDF export.
 */

const DATE_TOKENS: Record<string, (d: Date) => string> = {
  DD: (d) => String(d.getDate()).padStart(2, '0'),
  D: (d) => String(d.getDate()),
  MM: (d) => String(d.getMonth() + 1).padStart(2, '0'),
  M: (d) => String(d.getMonth() + 1),
  YYYY: (d) => String(d.getFullYear()),
  YY: (d) => String(d.getFullYear()).slice(-2),
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

export function formatDate(value: unknown, pattern = 'DD/MM/YYYY'): string {
  const d = toDate(value)
  if (!d) return ''
  // Replace longest tokens first so 'YYYY' isn't eaten by 'YY'.
  return pattern.replace(/YYYY|YY|DD|D|MM|M/g, (tok) => DATE_TOKENS[tok]?.(d) ?? tok)
}

export function formatCurrency(value: unknown, currency = 'XAF'): string {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return ''
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: currency === 'XAF' ? 0 : 2,
    }).format(n)
  } catch {
    return `${n.toLocaleString('en-US')} ${currency}`
  }
}

export function formatNumber(value: unknown, decimals = 0): string {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return ''
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

export function applyFormat(value: unknown, format: FormatSpec | undefined): string {
  if (value === null || value === undefined) return ''
  switch (format?.type) {
    case 'date':
      return formatDate(value, format.pattern)
    case 'currency':
      return formatCurrency(value, format.currency)
    case 'number':
      return formatNumber(value, format.decimals)
    case 'upper':
      return String(value).toUpperCase()
    case 'lower':
      return String(value).toLowerCase()
    case 'title':
      return String(value).replace(/\b\w/g, (c) => c.toUpperCase())
    default:
      return typeof value === 'object' ? JSON.stringify(value) : String(value)
  }
}

/** Resolve a binding against a data context to display text. */
export function resolveBinding(context: unknown, binding: Binding): string {
  const raw = resolvePath(context, binding.path)
  const isEmpty =
    raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')
  if (isEmpty) return binding.fallback ?? ''
  return applyFormat(raw, binding.format)
}
