import ExcelJS from 'exceljs'
import type { SheetDoc } from '../core/schema/template'
import { getCell, parseRange } from '../core/sheet/model'
import type { PageConfig } from '../core/schema/template'

const NUM_FMT: Record<string, string> = {
  number: '#,##0.00',
  currency: '#,##0',
  date: 'DD/MM/YYYY',
  percent: '0.0%',
}

const PAPER: Record<string, number | undefined> = {
  A4: 9,
  A3: 8,
  Letter: 1,
  Legal: 5,
}

/** Export the canonical sheet model to .xlsx via ExcelJS. */
export async function exportXlsx(doc: SheetDoc, name: string, page?: PageConfig): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Document Studio'
  const ws = wb.addWorksheet(name.slice(0, 31) || 'Sheet')

  // Column widths: px → character width units.
  for (let col = 1; col <= doc.colCount; col++) {
    const px = doc.colWidths[String(col)] ?? 90
    ws.getColumn(col).width = Math.max(6, Math.round(px / 7.2))
  }
  for (let row = 1; row <= doc.rowCount; row++) {
    const px = doc.rowHeights[String(row)]
    if (px) ws.getRow(row).height = px * 0.75
  }

  for (const [addr, cell] of Object.entries(doc.cells)) {
    const target = ws.getCell(addr)
    if (cell.f) {
      target.value = { formula: cell.f, result: typeof cell.v === 'number' || typeof cell.v === 'boolean' || cell.v === undefined ? cell.v : String(cell.v) } as ExcelJS.CellFormulaValue
    } else if (cell.v !== undefined) {
      target.value = cell.v as ExcelJS.CellValue
    }

    const st = cell.style
    if (st) {
      target.font = {
        bold: st.bold,
        italic: st.italic,
        underline: st.underline,
        color: st.color ? { argb: `FF${st.color.replace('#', '')}` } : undefined,
        size: st.fontSize ?? 11,
        name: st.fontFamily ?? 'Calibri',
      }
      target.alignment = { horizontal: st.align ?? 'left', vertical: 'middle' }
      if (st.background) {
        target.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${st.background.replace('#', '')}` } }
      }
      const fmt = st.format ? NUM_FMT[st.format] : undefined
      if (fmt) target.numFmt = fmt
      if (st.borders) {
        const side = { style: (st.borders.style === 'dashed' ? 'dashed' : st.borders.style === 'dotted' ? 'dotted' : 'thin') as ExcelJS.BorderStyle, color: { argb: `FF${(st.borders.color ?? '#9ca3af').replace('#', '')}` } }
        target.border = {
          top: st.borders.top ? side : undefined,
          right: st.borders.right ? side : undefined,
          bottom: st.borders.bottom ? side : undefined,
          left: st.borders.left ? side : undefined,
        }
      }
    }
  }

  for (const m of doc.merges) {
    const r = parseRange(`${m.start}:${m.end}`)
    if (r) ws.mergeCells(r.r1, r.c1, r.r2, r.c2)
  }

  if (doc.frozenRows > 0 || doc.frozenCols > 0) {
    ws.views = [{ state: 'frozen', xSplit: doc.frozenCols, ySplit: doc.frozenRows }]
  }

  const pm = page?.margins ?? { top: 10, right: 10, bottom: 10, left: 10 }
  ws.pageSetup = {
    orientation: doc.print.orientation,
    paperSize: PAPER[doc.print.size],
    fitToPage: true,
    fitToWidth: 1,
    margins: {
      top: pm.top / 25.4,
      right: pm.right / 25.4,
      bottom: pm.bottom / 25.4,
      left: pm.left / 25.4,
      header: 0.3,
      footer: 0.3,
    },
  }
  if (doc.print.repeatHeaderRows > 0) {
    ws.pageSetup.printTitlesRow = `1:${doc.print.repeatHeaderRows}`
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name || 'sheet'}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

/** Value shown when a formula's cached result is a literal. */
export function cellPrintValue(doc: SheetDoc, row: number, col: number): string {
  const cell = getCell(doc, row, col)
  if (!cell) return ''
  if (cell.v === undefined || cell.v === null) return ''
  if (typeof cell.v === 'boolean') return cell.v ? 'TRUE' : 'FALSE'
  return String(cell.v)
}
