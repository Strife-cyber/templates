import { nanoid } from 'nanoid'
import type { TemplateDoc, VisualElement } from '../core/schema/template'
import { createTemplate, emptySheetDoc } from '../core/schema/factories'
import { dexieRepository } from './templateRepository'

const el = (partial: Omit<VisualElement, 'id' | 'rotation' | 'z' | 'props'> & Partial<Pick<VisualElement, 'rotation' | 'z' | 'props'>>): VisualElement => ({
  id: `el_${nanoid(8)}`,
  rotation: 0,
  z: 0,
  props: {},
  ...partial,
})

type Format = 'date' | 'currency' | 'number' | 'upper' | 'title'
const FORMATS: Record<Format, NonNullable<NonNullable<VisualElement['binding']>['format']>> = {
  date: { type: 'date', pattern: 'DD/MM/YYYY' },
  currency: { type: 'currency', currency: 'XAF' },
  number: { type: 'number', decimals: 0 },
  upper: { type: 'upper' },
  title: { type: 'title' },
}
const bind = (path: string, format?: Format) => ({
  path,
  ...(format ? { format: FORMATS[format] } : {}),
})

function receipt(): TemplateDoc {
  const t = createTemplate({ name: 'Payment Receipt', category: 'financial', kind: 'visual', description: 'Student fee payment receipt' })
  t.pages = [{
    id: 'p1',
    elements: [
      el({ type: 'rect', x: 0, y: 0, w: 186, h: 34, boxStyle: { background: '#1f6f43' } }),
      el({ type: 'text', x: 6, y: 5, w: 130, h: 12, binding: bind('school.name'), textStyle: { fontSize: 17, fontWeight: 'bold', color: '#ffffff' } }),
      el({ type: 'text', x: 6, y: 19, w: 130, h: 10, binding: bind('school.address'), textStyle: { fontSize: 9, color: '#d9eadf' } }),
      el({ type: 'text', x: 100, y: 11, w: 80, h: 12, props: { text: 'PAYMENT RECEIPT' }, textStyle: { fontSize: 15, fontWeight: 'bold', align: 'right', color: '#ffffff' } }),
      el({ type: 'text', x: 6, y: 44, w: 90, h: 7, props: { text: 'Receipt No.' }, textStyle: { fontSize: 8, color: '#6b7280' } }),
      el({ type: 'text', x: 6, y: 51, w: 90, h: 9, binding: bind('payment.reference'), textStyle: { fontSize: 13, fontWeight: 'bold' } }),
      el({ type: 'text', x: 130, y: 44, w: 50, h: 7, props: { text: 'Date' }, textStyle: { fontSize: 8, color: '#6b7280', align: 'right' } }),
      el({ type: 'text', x: 120, y: 51, w: 60, h: 9, binding: bind('payment.date', 'date'), textStyle: { fontSize: 11, align: 'right' } }),
      el({ type: 'divider', x: 6, y: 66, w: 174, h: 0.4, boxStyle: { background: '#d1d5db' } }),
      el({ type: 'text', x: 6, y: 74, w: 60, h: 7, props: { text: 'Received from' }, textStyle: { fontSize: 8, color: '#6b7280' } }),
      el({ type: 'text', x: 6, y: 82, w: 110, h: 9, binding: bind('student.fullName'), textStyle: { fontSize: 12, fontWeight: 'bold' } }),
      el({ type: 'text', x: 6, y: 93, w: 60, h: 7, binding: bind('student.class'), textStyle: { fontSize: 9, color: '#374151' } }),
      el({ type: 'rect', x: 6, y: 106, w: 174, h: 26, boxStyle: { background: '#f3f6f4', borderWidth: 0.4, borderColor: '#d1d5db', borderRadius: 2 } }),
      el({ type: 'text', x: 12, y: 111, w: 80, h: 7, props: { text: 'Amount paid' }, textStyle: { fontSize: 8, color: '#6b7280' } }),
      el({ type: 'text', x: 12, y: 118, w: 110, h: 11, binding: bind('payment.amount', 'currency'), textStyle: { fontSize: 17, fontWeight: 'bold', color: '#1f6f43' } }),
      el({ type: 'text', x: 120, y: 118, w: 54, h: 11, binding: bind('payment.method'), textStyle: { fontSize: 11, align: 'right' } }),
      el({ type: 'text', x: 6, y: 140, w: 40, h: 7, props: { text: 'For' }, textStyle: { fontSize: 8, color: '#6b7280' } }),
      el({ type: 'text', x: 6, y: 147, w: 120, h: 8, binding: bind('payment.purpose'), textStyle: { fontSize: 11 } }),
      el({ type: 'qr', x: 150, y: 140, w: 30, h: 30, binding: bind('payment.reference') }),
      el({ type: 'line', x: 6, y: 205, w: 60, h: 0.3, boxStyle: { background: '#111827' } }),
      el({ type: 'text', x: 6, y: 208, w: 60, h: 6, props: { text: 'Received by (Bursar)' }, textStyle: { fontSize: 8, color: '#6b7280' } }),
      el({ type: 'text', x: 6, y: 240, w: 120, h: 6, props: { text: 'This receipt was generated electronically and is valid without signature.' }, textStyle: { fontSize: 7.5, color: '#9ca3af' } }),
      el({ type: 'pageNumber', x: 160, y: 265, w: 20, h: 6, props: { format: 'n/total' }, textStyle: { fontSize: 8, align: 'right', color: '#9ca3af' } }),
    ],
  }]
  return t
}

function reportCard(): TemplateDoc {
  const t = createTemplate({ name: 'Report Card', category: 'academic', kind: 'visual', description: 'End-of-term report card with subject table' })
  t.pages = [{
    id: 'p1',
    elements: [
      el({ type: 'text', x: 6, y: 4, w: 174, h: 10, binding: bind('school.name'), textStyle: { fontSize: 15, fontWeight: 'bold', align: 'center' } }),
      el({ type: 'text', x: 6, y: 16, w: 174, h: 7, binding: bind('academicReport.term'), textStyle: { fontSize: 9, align: 'center', color: '#4b5563' } }),
      el({ type: 'divider', x: 6, y: 26, w: 174, h: 0.4, boxStyle: { background: '#1f6f43' } }),
      el({ type: 'text', x: 6, y: 32, w: 120, h: 9, binding: bind('student.fullName'), textStyle: { fontSize: 13, fontWeight: 'bold' } }),
      el({ type: 'text', x: 6, y: 42, w: 60, h: 6, binding: bind('student.class'), textStyle: { fontSize: 9, color: '#4b5563' } }),
      el({ type: 'text', x: 130, y: 32, w: 50, h: 7, binding: bind('academicReport.rank'), textStyle: { fontSize: 10, align: 'right' } }),
      el({
        type: 'table', x: 6, y: 54, w: 174, h: 100,
        props: {
          rows: { path: 'academicReport.subjects[]' },
          columns: [
            { id: 'c1', header: 'Subject', widthMm: 62, align: 'left', binding: { path: 'academicReport.subjects[].subject' } },
            { id: 'c2', header: 'Mark /20', widthMm: 26, align: 'center', binding: { path: 'academicReport.subjects[].score' } },
            { id: 'c3', header: 'Coef', widthMm: 20, align: 'center', binding: { path: 'academicReport.subjects[].coefficient' } },
            { id: 'c4', header: 'Remark', widthMm: 66, align: 'left', binding: { path: 'academicReport.subjects[].remark' } },
          ],
          zebra: true,
          rowHeightMm: 8,
          headerHeightMm: 9,
          showHeader: true,
        },
      }),
      el({ type: 'text', x: 6, y: 160, w: 110, h: 9, binding: bind('academicReport.generalAverage'), textStyle: { fontSize: 12, fontWeight: 'bold' } }),
      el({ type: 'text', x: 120, y: 160, w: 60, h: 9, binding: bind('academicReport.decision', 'upper'), textStyle: { fontSize: 11, fontWeight: 'bold', align: 'right', color: '#1f6f43' } }),
      el({ type: 'line', x: 6, y: 225, w: 55, h: 0.3, boxStyle: { background: '#111827' } }),
      el({ type: 'text', x: 6, y: 228, w: 55, h: 6, props: { text: 'Principal' }, textStyle: { fontSize: 8, color: '#6b7280' } }),
      el({ type: 'pageNumber', x: 160, y: 265, w: 20, h: 6, props: { format: 'Page {n} of {total}' }, textStyle: { fontSize: 8, align: 'right', color: '#9ca3af' } }),
    ],
  }]
  return t
}

function classPv(): TemplateDoc {
  const t = createTemplate({ name: 'Class PV — Term Averages', category: 'academic', kind: 'sheet', description: 'Class results grid bound to the student roster' })
  const sheet = emptySheetDoc()
  sheet.colWidths = { '1': 110, '2': 110, '3': 62, '4': 62, '5': 62, '6': 62, '7': 62, '8': 70, '9': 60, '10': 84 }
  const headers = ['Name', 'Maths', 'English', 'Physics', 'Chemistry', 'Biology', 'French', 'Average', 'Rank', 'Decision']
  headers.forEach((h, i) => {
    sheet.cells[`${String.fromCharCode(65 + i)}1`] = { v: h, origin: 'manual', style: { bold: true, background: '#e5efe9', align: 'center', borders: { bottom: true } } }
  })
  sheet.rowSource = {
    source: 'demo',
    collectionPath: 'students[]',
    startRow: 2,
    mapping: {
      A: 'student.fullName',
      B: 'results.Mathematics',
      C: 'results.English',
      D: 'results.Physics',
      E: 'results.Chemistry',
      F: 'results.Biology',
      G: 'results.French',
      I: 'rank',
    },
  }
  // Formula columns seeded for the first rows (the user extends by copying down).
  for (let r = 2; r <= 25; r++) {
    sheet.cells[`H${r}`] = { f: `IF(COUNT(B${r}:G${r})=0,"",ROUND(AVERAGE(B${r}:G${r}),2))`, origin: 'formula', style: { align: 'center', bold: true } }
    sheet.cells[`J${r}`] = { f: `IF(H${r}="","",IF(H${r}>=10,"Admitted","Repeat"))`, origin: 'formula', style: { align: 'center' } }
  }
  sheet.frozenRows = 1
  sheet.frozenCols = 2
  sheet.print = { size: 'A4', orientation: 'landscape', area: null, repeatHeaderRows: 1 }
  t.sheet = sheet
  return t
}

export const SAMPLE_TEMPLATES = [receipt, reportCard, classPv]

const SEED_FLAG = 'document-studio:samples-seeded'

/** Insert the shipped sample templates once (first run). */
export async function seedSampleTemplates(): Promise<void> {
  if (localStorage.getItem(SEED_FLAG)) return
  const existing = await dexieRepository.list()
  if (existing.length === 0) {
    for (const build of SAMPLE_TEMPLATES) await dexieRepository.put(build())
  }
  localStorage.setItem(SEED_FLAG, '1')
}
