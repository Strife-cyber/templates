import type { ReactNode } from 'react'
import { Document, Page, View, Text, pdf } from '@react-pdf/renderer'
import type { PageConfig, SheetDoc, SheetCell } from '../../core/schema/template'
import { colWidth, getCell, parseRange, usedRange } from '../../core/sheet/model'
import { registerPdfFonts, pdfFontFamily } from './fonts'

const PT_PER_PX = 0.75
const PT_PER_MM = 72 / 25.4

function cellText(cell: SheetCell | undefined): string {
  if (!cell) return ''
  if (cell.v === undefined || cell.v === null) return ''
  if (typeof cell.v === 'boolean') return cell.v ? 'TRUE' : 'FALSE'
  return String(cell.v)
}

function SheetPdfDocument({ sheet, title, page }: { sheet: SheetDoc; title: string; page: PageConfig }) {
  const mm = page.margins
  const landscape = sheet.print.orientation === 'landscape'
  const baseW = sheet.print.size === 'A3' ? 297 : sheet.print.size === 'custom' ? page.widthMm : 210
  const baseH = sheet.print.size === 'A3' ? 420 : sheet.print.size === 'custom' ? page.heightMm : 297
  const widthMm = landscape ? Math.max(baseW, baseH) : Math.min(baseW, baseH)
  const heightMm = landscape ? Math.min(baseW, baseH) : Math.max(baseW, baseH)
  const contentW = (widthMm - mm.left - mm.right) * PT_PER_MM
  const contentH = (heightMm - mm.top - mm.bottom) * PT_PER_MM

  const area = sheet.print.area ? parseRange(sheet.print.area) : null
  const { r1, r2, c1, c2 } = area ?? usedRange(sheet)
  const headerRows = Math.min(sheet.print.repeatHeaderRows, r2 - r1 + 1)

  // Column widths in pt, scaled down to fit content width when needed.
  const rawW: number[] = []
  let total = 0
  for (let c = c1; c <= c2; c++) {
    const w = colWidth(sheet, c) * PT_PER_PX
    rawW.push(w)
    total += w
  }
  const scale = total > contentW ? contentW / total : 1
  const colW = rawW.map((w) => w * scale)

  // Pack rows into pages.
  const headerH = headerRows
    ? Array.from({ length: headerRows }, (_, i) => (sheet.rowHeights[String(r1 + i)] ?? 24) * PT_PER_PX).reduce((a, b) => a + b, 0)
    : 0
  const pages: number[][] = []
  let rows: number[] = []
  let used = 0
  for (let r = r1; r <= r2; r++) {
    const h = (sheet.rowHeights[String(r)] ?? 24) * PT_PER_PX
    const isHeader = headerRows > 0 && r < r1 + headerRows
    const avail = isHeader || rows.length === 0 ? contentH : contentH - headerH
    if (used + h > avail && rows.length) {
      pages.push(rows)
      rows = []
      used = 0
    }
    rows.push(r)
    used += h
  }
  if (rows.length) pages.push(rows)

  const renderRow = (r: number, isHeaderRow: boolean): ReactNode => {
    const cells: ReactNode[] = []
    for (let c = c1; c <= c2; c++) {
      const ci = c - c1
      let span = 1
      let covered = false
      for (const m of sheet.merges) {
        const mr = parseRange(`${m.start}:${m.end}`)
        if (!mr || r < mr.r1 || r > mr.r2 || c < mr.c1 || c > mr.c2) continue
        if (r === mr.r1 && c === mr.c1) span = mr.c2 - mr.c1 + 1
        else covered = true
      }
      if (covered) continue
      const cell = getCell(sheet, r, c)
      const st = cell?.style
      const w = colW.slice(ci, ci + span).reduce((a, b) => a + b, 0)
      cells.push(
        <View
          key={c}
          style={{
            width: w,
            borderRight: '0.5pt solid #d1d5db',
            borderBottom: '0.5pt solid #d1d5db',
            padding: '2pt 4pt',
            backgroundColor: st?.background,
          }}
        >
          <Text
            style={{
              fontSize: (st?.fontSize ?? 10) * 0.9,
              fontFamily: pdfFontFamily(st?.fontFamily ?? 'Inter'),
              fontWeight: st?.bold ? 700 : 400,
              fontStyle: st?.italic ? 'italic' : 'normal',
              textDecoration: st?.underline ? 'underline' : undefined,
              textAlign: st?.align ?? 'left',
              color: st?.color ?? '#111827',
            }}
          >
            {cellText(cell)}
          </Text>
        </View>,
      )
    }
    return (
      <View key={r} style={{ flexDirection: 'row', backgroundColor: isHeaderRow ? '#f3f4f6' : undefined }}>
        {cells}
      </View>
    )
  }

  return (
    <Document title={title} author="Document Studio">
      {pages.map((pageRows, pi) => (
        <Page
          key={pi}
          size={{ width: widthMm * PT_PER_MM, height: heightMm * PT_PER_MM }}
          style={{ padding: `${mm.top}mm ${mm.right}mm ${mm.bottom}mm ${mm.left}mm`, fontFamily: 'Inter' }}
        >
          <View style={{ borderTop: '0.5pt solid #d1d5db', borderLeft: '0.5pt solid #d1d5db' }}>
            {pi > 0 && headerRows > 0 && Array.from({ length: headerRows }, (_, i) => renderRow(r1 + i, true))}
            {pageRows.map((r) => renderRow(r, headerRows > 0 && pi === 0 && r < r1 + headerRows))}
          </View>
          <Text
            fixed
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
            style={{ position: 'absolute', bottom: 6, right: 12, fontSize: 8, color: '#6b7280' }}
          />
        </Page>
      ))}
    </Document>
  )
}

export async function exportSheetPdf(sheet: SheetDoc, name: string, page: PageConfig): Promise<void> {
  registerPdfFonts()
  const blob = await pdf(<SheetPdfDocument sheet={sheet} title={name} page={page} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name || 'sheet'}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
