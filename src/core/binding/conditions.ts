import type { Condition } from '../schema/template'
import { resolvePath } from './paths'

/** Evaluate a visibility condition against the data context. */
export function evaluateCondition(context: unknown, cond: Condition): boolean {
  const value = resolvePath(context, cond.path)
  const isEmpty =
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)

  switch (cond.op) {
    case 'exists':
      return !isEmpty
    case 'empty':
      return isEmpty
    case 'eq':
      return looseEq(value, cond.value)
    case 'neq':
      return !looseEq(value, cond.value)
    case 'contains': {
      if (typeof value === 'string' && cond.value !== undefined)
        return value.toLowerCase().includes(String(cond.value).toLowerCase())
      if (Array.isArray(value)) return value.some((v) => looseEq(v, cond.value))
      return false
    }
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const a = typeof value === 'number' ? value : Number(value)
      const b = typeof cond.value === 'number' ? cond.value : Number(cond.value)
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false
      return cond.op === 'gt' ? a > b : cond.op === 'gte' ? a >= b : cond.op === 'lt' ? a < b : a <= b
    }
  }
}

function looseEq(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a === 'string' && typeof b === 'string') return a === b
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b)
  if (typeof a === 'boolean' || typeof b === 'boolean') return Boolean(a) === Boolean(b)
  return String(a) === String(b)
}
