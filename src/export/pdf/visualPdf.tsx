import { Document, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import type { ResolvedDocument, ResolvedElement, ResolvedTable } from '../../core/render/types'
import type { BoxStyle, TextStyle } from '../../core/schema/template'
import { pdfFontFamily, registerPdfFonts } from './fonts'
import { htmlToPdfNodes } from './richText'

const mm = (n: number) => `${n}mm`

function textStyle(s: TextStyle) {
  return {
    fontFamily: pdfFontFamily(s.fontFamily),
    fontSize: s.fontSize,
    fontWeight: s.fontWeight === 'bold' ? 700 : s.fontWeight,
    fontStyle: s.fontStyle,
    textDecoration: s.underline ? 'underline' : 'none',
    textAlign: s.align,
    color: s.color,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
  } as const
}

function boxStyle(s: BoxStyle) {
  return {
    backgroundColor: s.background === 'transparent' ? undefined : s.background,
    borderWidth: s.borderWidth ? `${s.borderWidth}mm` : 0,
    borderColor: s.borderColor,
    borderStyle: s.borderStyle,
    borderRadius: `${s.borderRadius}mm`,
    padding: `${s.padding}mm`,
    opacity: s.opacity,
  } as const
}

function PdfTable({ el }: { el: ResolvedElement }) {
  const t = el.table as ResolvedTable
  const borderColor = el.boxStyle.borderColor
  const bw = Math.max(el.boxStyle.borderWidth, 0.2)
  const cell = {
    borderWidth: `${bw}mm`,
    borderColor,
    borderStyle: 'solid' as const,
    paddingHorizontal: '1.5mm',
    justifyContent: 'center' as const,
    fontSize: el.textStyle.fontSize,
    fontFamily: pdfFontFamily(el.textStyle.fontFamily),
    color: el.textStyle.color,
  }
  return (
    <View>
      {t.showHeader && (
        <View style={{ flexDirection: 'row' }}>
          {t.columns.map((c) => (
            <Text
              key={c.id}
              style={{
                ...cell,
                width: `${c.widthMm}mm`,
                height: `${t.headerHeightMm}mm`,
                textAlign: c.align,
                fontWeight: 600,
                backgroundColor: '#f3f4f6',
              }}
            >
              {c.header}
            </Text>
          ))}
        </View>
      )}
      {t.rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', ...(t.zebra && ri % 2 ? { backgroundColor: '#f9fafb' } : {}) }}>
          {row.map((c, ci) => (
            <Text key={ci} style={{ ...cell, width: `${t.columns[ci]?.widthMm ?? 20}mm`, height: `${t.rowHeightMm}mm`, textAlign: c.align }}>
              {c.text}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

function PdfElement({ el, qrImages }: { el: ResolvedElement; qrImages: Map<string, string> }) {
  const base = {
    position: 'absolute' as const,
    left: mm(el.x),
    top: mm(el.y),
    width: mm(el.w),
    height: mm(el.h),
    ...(el.rotation ? { transform: `rotate(${el.rotation}deg)` } : {}),
    ...boxStyle(el.boxStyle),
  }

  switch (el.type) {
    case 'text':
    case 'pageNumber':
      return <Text style={[base, textStyle(el.textStyle), StyleSheet.create({ s: { overflow: 'hidden' } }).s]}>{el.text ?? ''}</Text>
    case 'richText':
      return (
        <Text style={[base, textStyle(el.textStyle)]}>
          {htmlToPdfNodes(el.html ?? '', {})}
        </Text>
      )
    case 'image':
      return el.src ? (
        <Image src={el.src} style={{ ...base, objectFit: el.fit === 'fill' ? 'fill' : el.fit }} />
      ) : null
    case 'qr': {
      const src = el.id ? qrImages.get(el.id) : undefined
      return src ? <Image src={src} style={base} /> : null
    }
    case 'rect':
      return <View style={base} />
    case 'line':
    case 'divider':
      return (
        <View
          style={{
            position: 'absolute',
            left: mm(el.x),
            top: mm(el.y + el.h / 2),
            width: mm(el.w),
            borderTopWidth: `${Math.max(el.boxStyle.borderWidth, 0.2)}mm`,
            borderTopColor: el.boxStyle.borderColor,
            borderTopStyle: el.boxStyle.borderStyle,
            opacity: el.boxStyle.opacity,
          }}
        />
      )
    case 'table':
      return (
        <View style={base}>
          <PdfTable el={el} />
        </View>
      )
    default:
      return null
  }
}

export function VisualPdfDocument({ doc, qrImages }: { doc: ResolvedDocument; qrImages: Map<string, string> }) {
  registerPdfFonts()
  return (
    <Document>
      {doc.pages.map((page) => (
        <Page key={page.id} size={{ width: `${doc.widthMm}mm`, height: `${doc.heightMm}mm` }} style={{ position: 'relative' }}>
          <View
            style={{
              position: 'absolute',
              left: mm(doc.margins.left),
              top: mm(doc.margins.top),
              width: mm(doc.widthMm - doc.margins.left - doc.margins.right),
              height: mm(doc.heightMm - doc.margins.top - doc.margins.bottom),
            }}
          >
            {page.elements.map((el) => (
              <PdfElement key={el.id} el={el} qrImages={qrImages} />
            ))}
          </View>
        </Page>
      ))}
    </Document>
  )
}

/** Render the resolved document to a real PDF file and trigger download. */
export async function exportVisualPdf(doc: ResolvedDocument, name: string): Promise<void> {
  registerPdfFonts()

  // Pre-render QR codes to PNG data URIs (react-pdf can't render QR SVGs).
  const qrImages = new Map<string, string>()
  for (const page of doc.pages) {
    for (const el of page.elements) {
      if (el.type === 'qr' && el.text) {
        try {
          qrImages.set(el.id, await QRCode.toDataURL(el.text, { margin: 0, width: 256 }))
        } catch {
          // skip broken QR values
        }
      }
    }
  }

  const blob = await pdf(<VisualPdfDocument doc={doc} qrImages={qrImages} />).toBlob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${name.replace(/[^\w-]+/g, '-').toLowerCase()}.pdf`
  a.click()
  URL.revokeObjectURL(a.href)
}
