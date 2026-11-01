/**
 * Safe dotted-path resolution against an arbitrary data context.
 *
 * Paths look like `student.fullName` or `academicReport.subjects[3].grade`.
 * Resolution is deliberately restricted: only own enumerable properties are
 * walked, `__proto__`/`constructor`/`prototype` segments are refused, and array
 * indexing goes through `[n]` segments. There is no `eval`, no function calls.
 */

const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype'])

export type PathToken = string | number

const SEGMENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*(\[\d+\])*$/

export function parsePath(path: string): PathToken[] | null {
  if (!path || typeof path !== 'string') return null
  const tokens: PathToken[] = []
  for (const segment of path.split('.')) {
    if (!SEGMENT_RE.test(segment)) return null
    const [head, ...indexes] = segment.split(/[\[\]]/).filter(Boolean)
    if (!head || FORBIDDEN.has(head)) return null
    tokens.push(head)
    for (const ix of indexes) tokens.push(Number(ix))
  }
  return tokens.length ? tokens : null
}

export function resolvePath(context: unknown, path: string): unknown {
  const tokens = parsePath(path)
  if (!tokens) return undefined
  let node: unknown = context
  for (const token of tokens) {
    if (node === null || node === undefined) return undefined
    if (typeof token === 'number') {
      if (!Array.isArray(node)) return undefined
      node = node[token]
    } else {
      if (typeof node !== 'object') return undefined
      if (!Object.prototype.hasOwnProperty.call(node, token)) return undefined
      node = (node as Record<string, unknown>)[token]
    }
  }
  return node
}

/** List the dot paths available under an object — used by the binding picker. */
export function listPaths(context: unknown, prefix = '', depth = 0, maxDepth = 3): string[] {
  if (depth >= maxDepth || typeof context !== 'object' || context === null) return []
  const out: string[] = []
  for (const [key, value] of Object.entries(context)) {
    if (FORBIDDEN.has(key)) continue
    const path = prefix ? `${prefix}.${key}` : key
    if (Array.isArray(value)) {
      out.push(`${path}[]`)
      const first = value[0]
      if (typeof first === 'object' && first !== null) {
        out.push(...listPaths(first, `${path}[]`, depth + 1, maxDepth))
      }
    } else if (typeof value === 'object' && value !== null) {
      out.push(path)
      out.push(...listPaths(value, path, depth + 1, maxDepth))
    } else {
      out.push(path)
    }
  }
  return out
}
