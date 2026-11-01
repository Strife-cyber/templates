import type { SheetCell, SheetDoc } from '../schema/template'

/**
 * Canonical spreadsheet model helpers.
 * Addresses are A1-style: column letters + 1-based row. Rows/cols are 1-based
 * internally (row 0 is the column-header row, col 0 the row-header column).
 */

const COL_BASE = 26
const A = 65

export function colName(col: number): string {
  // 1-based → 'A'.. 'Z', 'AA'..
  let n = col
  let s = ''
  while (n > 0) {
    const r = (n - 1) % COL_BASE
    s = String.fromCharCode(A + r) + s
    n = Math.floor((n - 1) / COL_BASE)
  }
  return s
}

export function colIndex(name: string): number {
  let n = 0
  for (const ch of name.toUpperCase()) {
    if (ch < 'A' || ch > 'Z') return -1
    n = n * COL_BASE + (ch.charCodeAt(0) - A + 1)
  }
  return n
}

export function a1(row: number, col: number): string {
  return `${colName(col)}${row}`
}

const A1_RE = /^([A-Z]+)(\d+)$/

export function parseA1(addr: string): { row: number; col: number } | null {
  const m = A1_RE.exec(addr.toUpperCase())
  if (!m) return null
  return { col: colIndex(m[1]!), row: Number(m[2]) }
}

export function parseRange(range: string): { r1: number; c1: number; r2: number; c2: number } | null {
  const [a, b] = range.split(':')
  const p1 = a ? parseA1(a) : null
  const p2 = b ? parseA1(b) : p1
  if (!p1 || !p2) return null
  return {
    r1: Math.min(p1.row, p2.row),
    c1: Math.min(p1.col, p2.col),
    r2: Math.max(p1.row, p2.row),
    c2: Math.max(p1.col, p2.col),
  }
}

export function getCell(doc: SheetDoc, row: number, col: number): SheetCell | undefined {
  return doc.cells[a1(row, col)]
}

export function setCell(doc: SheetDoc, row: number, col: number, cell: SheetCell | undefined): void {
  const key = a1(row, col)
  if (cell === undefined) delete doc.cells[key]
  else doc.cells[key] = cell
}

/** Merge anchor: if (row,col) is inside a merge, returns the merge + anchor pos. */
export function mergeAt(doc: SheetDoc, row: number, col: number) {
  for (const m of doc.merges) {
    const r = parseRange(`${m.start}:${m.end}`)
    if (r && row >= r.r1 && row <= r.r2 && col >= r.c1 && col <= r.c2) {
      return { ...r, isAnchor: row === r.r1 && col === r.c1 }
    }
  }
  return null
}

/** Used range (non-empty cells) — defaults to the full sheet when empty. */
export function usedRange(doc: SheetDoc): { r1: number; c1: number; r2: number; c2: number } {
  let r1 = Infinity, c1 = Infinity, r2 = 0, c2 = 0
  for (const key of Object.keys(doc.cells)) {
    const p = parseA1(key)
    if (!p) continue
    r1 = Math.min(r1, p.row)
    c1 = Math.min(c1, p.col)
    r2 = Math.max(r2, p.row)
    c2 = Math.max(c2, p.col)
  }
  if (r2 === 0) return { r1: 1, c1: 1, r2: doc.rowCount, c2: doc.colCount }
  return { r1, c1, r2: Math.min(r2, doc.rowCount), c2: Math.min(c2, doc.colCount) }
}

export const DEFAULT_COL_W = 90
export const DEFAULT_ROW_H = 24

export function colWidth(doc: SheetDoc, col: number): number {
  return doc.colWidths[String(col)] ?? DEFAULT_COL_W
}

export function rowHeight(doc: SheetDoc, row: number): number {
  return doc.rowHeights[String(row)] ?? DEFAULT_ROW_H
}
