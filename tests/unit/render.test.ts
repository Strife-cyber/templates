import { describe, expect, it } from 'vitest'
import { resolveVisualDocument } from '../../src/core/render/resolve'
import { createTemplate } from '../../src/core/schema/factories'
import type { VisualElement } from '../../src/core/schema/template'

const ctx = {
  student: { fullName: 'Ngo Bell Acha' },
  academicReport: {
    subjects: Array.from({ length: 40 }, (_, i) => ({ subject: `Sub ${i}`, score: i })),
  },
}

function makeTemplate(elements: VisualElement[]) {
  const t = createTemplate({ name: 'T', category: 'general', kind: 'visual' })
  t.pages = [{ id: 'p1', elements }]
  return t
}

const el = (partial: Partial<VisualElement>): VisualElement => ({
  id: `e${Math.random()}`,
  type: 'text',
  x: 0,
  y: 0,
  w: 50,
  h: 8,
  rotation: 0,
  z: 0,
  props: {},
  ...partial,
})

describe('visual resolve', () => {
  it('resolves bound text', () => {
    const doc = resolveVisualDocument(makeTemplate([el({ binding: { path: 'student.fullName' } })]), ctx)
    expect(doc.pages[0]?.elements[0]?.text).toBe('Ngo Bell Acha')
  })
  it('hides elements failing visibility conditions', () => {
    const doc = resolveVisualDocument(
      makeTemplate([
        el({ binding: { path: 'student.fullName' }, visibleWhen: { path: 'student.missing', op: 'exists' } }),
      ]),
      ctx,
    )
    expect(doc.pages[0]?.elements.length).toBe(0)
  })
  it('expands and paginates repeating tables', () => {
    const table = el({
      type: 'table',
      y: 200, // little room left on an A4 page (content height ~273mm)
      props: {
        columns: [{ id: 'c', header: 'Subject', widthMm: 50, align: 'left', binding: { path: 'subject' } }],
        rows: { path: 'academicReport.subjects' },
        showHeader: true,
        rowHeightMm: 8,
        headerHeightMm: 9,
      },
    })
    const doc = resolveVisualDocument(makeTemplate([table]), ctx)
    // 40 rows * 8mm = 320mm + 9mm header needs more than one page.
    expect(doc.pageCount).toBeGreaterThan(1)
    const totalRows = doc.pages.reduce((n, p) => n + (p.elements[0]?.table?.rows.length ?? 0), 0)
    expect(totalRows).toBe(40)
    // Continuation pages start the table at the top.
    expect(doc.pages[1]?.elements[0]?.y).toBe(0)
  })
  it('resolves page numbers with totals', () => {
    const pn = el({ type: 'pageNumber', props: { format: 'n/total' } })
    const table = el({
      type: 'table',
      y: 250,
      props: {
        columns: [{ id: 'c', header: 'S', widthMm: 50, align: 'left', binding: { path: 'subject' } }],
        rows: { path: 'academicReport.subjects' },
        showHeader: true,
        rowHeightMm: 8,
        headerHeightMm: 9,
      },
    })
    const doc = resolveVisualDocument(makeTemplate([pn, table]), ctx)
    expect(doc.pages[0]?.elements.find((e) => e.type === 'pageNumber')?.text).toBe(`1 / ${doc.pageCount}`)
  })
})
