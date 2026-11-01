import { describe, it, expect } from 'vitest'
import { a1, colName, colIndex, parseA1, parseRange, mergeAt, usedRange } from '../../src/core/sheet/model'
import { setCellContent, evaluateSheet, formulaRefs } from '../../src/core/sheet/formula'
import { emptySheetDoc } from '../../src/core/schema/factories'

describe('A1 addressing', () => {
  it('converts column names', () => {
    expect(colName(1)).toBe('A')
    expect(colName(26)).toBe('Z')
    expect(colName(27)).toBe('AA')
    expect(colIndex('A')).toBe(1)
    expect(colIndex('AB')).toBe(28)
  })
  it('parses addresses and ranges', () => {
    expect(parseA1('B3')).toEqual({ row: 3, col: 2 })
    expect(parseA1('bad')).toBeNull()
    expect(parseRange('B2:D4')).toEqual({ r1: 2, c1: 2, r2: 4, c2: 4 })
    expect(parseRange('D4:B2')).toEqual({ r1: 2, c1: 2, r2: 4, c2: 4 })
  })
  it('a1 round-trips', () => {
    expect(a1(3, 2)).toBe('B3')
  })
})

describe('setCellContent', () => {
  it('stores numbers as numbers, text as text', () => {
    const doc = emptySheetDoc()
    setCellContent(doc, 1, 1, '42')
    setCellContent(doc, 1, 2, 'hello')
    expect(doc.cells['A1']?.v).toBe(42)
    expect(doc.cells['B1']?.v).toBe('hello')
  })
  it('stores formulas with formula origin', () => {
    const doc = emptySheetDoc()
    setCellContent(doc, 1, 1, '=SUM(B1:C1)')
    expect(doc.cells['A1']?.f).toBe('SUM(B1:C1)')
    expect(doc.cells['A1']?.origin).toBe('formula')
  })
  it('marks edits to source cells as overridden', () => {
    const doc = emptySheetDoc()
    doc.cells['B2'] = { v: 15, origin: 'source', b: '{$score}' }
    setCellContent(doc, 2, 2, '18')
    expect(doc.cells['B2']?.origin).toBe('overridden')
    expect(doc.cells['B2']?.v).toBe(18)
  })
  it('clears cells on empty input but keeps style', () => {
    const doc = emptySheetDoc()
    doc.cells['A1'] = { v: 'x', origin: 'manual', style: { bold: true } }
    setCellContent(doc, 1, 1, '  ')
    expect(doc.cells['A1']?.v).toBeUndefined()
    expect(doc.cells['A1']?.style?.bold).toBe(true)
  })
})

describe('formula evaluation', () => {
  it('evaluates SUM over a range', () => {
    const doc = emptySheetDoc()
    setCellContent(doc, 1, 1, '10')
    setCellContent(doc, 2, 1, '20')
    setCellContent(doc, 3, 1, '30')
    setCellContent(doc, 4, 1, '=SUM(A1:A3)')
    const res = evaluateSheet(doc)
    expect(res.errors.size).toBe(0)
    expect(doc.cells['A4']?.v).toBe(60)
  })
  it('evaluates chained formulas in dependency order', () => {
    const doc = emptySheetDoc()
    setCellContent(doc, 1, 1, '5')
    setCellContent(doc, 1, 2, '=A1*2')   // B1 = 10
    setCellContent(doc, 1, 3, '=B1+A1')  // C1 = 15 — declared after use? order-independent
    const res = evaluateSheet(doc)
    expect(res.errors.size).toBe(0)
    expect(doc.cells['C1']?.v).toBe(15)
  })
  it('detects direct cycles', () => {
    const doc = emptySheetDoc()
    setCellContent(doc, 1, 1, '=B1')
    setCellContent(doc, 1, 2, '=A1')
    evaluateSheet(doc)
    expect(doc.cells['A1']?.v === '#CYCLE!' || doc.cells['B1']?.v === '#CYCLE!').toBe(true)
  })
  it('reports unknown functions as errors, never throws', () => {
    const doc = emptySheetDoc()
    setCellContent(doc, 1, 1, '=NOSUCHFN(1)')
    evaluateSheet(doc)
    expect(String(doc.cells['A1']?.v)).toMatch(/^#/)
  })
  it('extracts referenced addresses', () => {
    const refs = formulaRefs('=SUM(A1:B2)+C5')
    expect(refs).toContain('A1')
    expect(refs).toContain('B2')
    expect(refs).toContain('C5')
  })
})

describe('merges + usedRange', () => {
  it('finds a merge containing a cell', () => {
    const doc = emptySheetDoc()
    doc.merges.push({ start: 'B2', end: 'D2' })
    expect(mergeAt(doc, 2, 3)?.isAnchor).toBe(false)
    expect(mergeAt(doc, 2, 2)?.isAnchor).toBe(true)
    expect(mergeAt(doc, 3, 3)).toBeNull()
  })
  it('computes used range', () => {
    const doc = emptySheetDoc()
    setCellContent(doc, 3, 4, 'x')
    setCellContent(doc, 8, 2, 'y')
    expect(usedRange(doc)).toEqual({ r1: 3, c1: 2, r2: 8, c2: 4 })
  })
})
