import FormulaParser, { type DepRef } from 'fast-formula-parser'
import { a1, colName, getCell, setCell, parseRange } from './model'
import type { SheetDoc } from '../schema/template'

/**
 * Safe formula evaluation over the canonical sheet model.
 * `fast-formula-parser` parses via an LL(1) grammar — no `eval`, no code exec.
 */

export type CellValue = string | number | boolean | null

export interface EvalResult {
  /** Display values keyed by A1. Formula errors become '#ERR!'-style strings. */
  values: Map<string, CellValue>
  errors: Map<string, string>
}

const CELL_REF = /\$?([A-Za-z]{1,3})\$?(\d+)(?::\$?([A-Za-z]{1,3})\$?(\d+))?/g

/** Extract A1 addresses a formula references (cells and ranges, expanded). */
export function formulaRefs(formula: string): string[] {
  const refs = new Set<string>()
  const src = formula.replace(/^=/, '')
  let m: RegExpExecArray | null
  CELL_REF.lastIndex = 0
  while ((m = CELL_REF.exec(src)) !== null) {
    if (m[3] && m[4]) {
      const r = parseRange(`${m[1]}${m[2]}:${m[3]}${m[4]}`)
      if (r && (r.r2 - r.r1 + 1) * (r.c2 - r.c1 + 1) <= 10_000) {
        for (let row = r.r1; row <= r.r2; row++)
          for (let col = r.c1; col <= r.c2; col++) refs.add(a1(row, col))
      }
    } else {
      refs.add(`${m[1]!.toUpperCase()}${m[2]}`)
    }
  }
  return [...refs]
}

/** Raw (pre-format) value a cell contributes to formulas. */
export function rawCellValue(doc: SheetDoc, addr: string): CellValue {
  const cell = doc.cells[addr]
  if (!cell) return null
  if (cell.f) {
    // Use the cached evaluated value if present.
    return cell.v ?? null
  }
  return cell.v ?? null
}

/**
 * Evaluate all formula cells in dependency order; detects cycles.
 * Writes evaluated values back onto the formula cells' `v` so downstream
 * consumers (export, display) can read them.
 */
export function evaluateSheet(doc: SheetDoc): EvalResult {
  const values = new Map<string, CellValue>()
  const errors = new Map<string, string>()

  // Snapshot literal values for the parser to read.
  const getValue = (addr: string): CellValue => {
    const cell = doc.cells[addr]
    if (!cell) return null
    if (cell.f) return values.get(addr) ?? cell.v ?? null
    return cell.v ?? null
  }

  const parser = new FormulaParser({
    onCell: (ref: DepRef) => {
      // Dep rows/cols are 1-based, matching our A1 model.
      return getValue(`${colName(ref.col)}${ref.row}`)
    },
    onRange: (ref: { from: DepRef; to: DepRef }) => {
      const arr: CellValue[][] = []
      for (let r = ref.from.row; r <= ref.to.row; r++) {
        const row: CellValue[] = []
        for (let c = ref.from.col; c <= ref.to.col; c++) {
          row.push(getValue(`${colName(c)}${r}`))
        }
        arr.push(row)
      }
      return arr
    },
  })

  // Topological order: repeatedly evaluate formulas whose deps are resolved.
  const formulaCells = new Map<string, string>()
  for (const [addr, cell] of Object.entries(doc.cells)) {
    if (cell.f) formulaCells.set(addr, cell.f.replace(/^=/, ''))
  }

  const pending = new Map(formulaCells)
  const visiting = new Set<string>()
  const done = new Set<string>()

  const evalCell = (addr: string): void => {
    if (done.has(addr)) return
    if (visiting.has(addr)) {
      errors.set(addr, '#CYCLE!')
      values.set(addr, '#CYCLE!')
      done.add(addr)
      return
    }
    visiting.add(addr)
    // Evaluate dependencies first when they are themselves formulas.
    for (const dep of formulaRefs(pending.get(addr) ?? '')) {
      if (pending.has(dep) && dep !== addr) evalCell(dep)
    }
    visiting.delete(addr)
    try {
      const res = parser.parse(pending.get(addr) ?? '', { row: 0, col: 0 }) as CellValue | { error?: string }
      if (res && typeof res === 'object' && 'error' in res && (res as { error?: string }).error) {
        const err = String((res as { error?: string }).error)
        errors.set(addr, err.startsWith('#') ? err : '#ERR!')
        values.set(addr, errors.get(addr)!)
      } else {
        values.set(addr, res as CellValue)
      }
    } catch (e) {
      const msg = (e as Error).message ?? 'error'
      const err = msg.startsWith('#') ? msg : '#ERR!'
      errors.set(addr, err)
      values.set(addr, err)
    }
    done.add(addr)
  }

  for (const addr of pending.keys()) evalCell(addr)

  // Write evaluated values back onto cells (display layer reads cell.v for
  // formula cells).
  for (const [addr, v] of values) {
    const cell = doc.cells[addr]
    if (cell?.f) cell.v = typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : String(v ?? '')
  }

  return { values, errors }
}

/** Set a cell's content, inferring kind + origin. */
export function setCellContent(
  doc: SheetDoc,
  row: number,
  col: number,
  raw: string,
  userOrigin: 'manual' | 'overridden' = 'manual',
): void {
  const existing = getCell(doc, row, col)
  const style = existing?.style
  const trimmed = raw.trim()

  if (!trimmed) {
    setCell(doc, row, col, style ? { origin: 'manual', style } : undefined)
    return
  }
  if (trimmed.startsWith('=')) {
    setCell(doc, row, col, { f: trimmed.slice(1), origin: 'formula', style })
    return
  }
  const n = Number(trimmed.replace(/,/g, ''))
  const isNum = trimmed !== '' && !Number.isNaN(n) && /^[-+]?[\d.,%]+$/.test(trimmed)
  const origin =
    existing?.origin === 'source' ? 'overridden' : existing?.origin === 'overridden' ? 'overridden' : userOrigin
  setCell(doc, row, col, { v: isNum ? n : trimmed, origin, b: existing?.b, style })
}
