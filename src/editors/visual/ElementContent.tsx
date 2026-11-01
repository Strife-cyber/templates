import QRCode from 'react-qr-code'
import type { CSSProperties } from 'react'
import type { ResolvedElement } from '../../core/render/types'
import type { BoxStyle, TextStyle } from '../../core/schema/template'

export const MM_TO_PX = 96 / 25.4

export function textCss(s: TextStyle): CSSProperties {
  return {
    fontFamily: s.fontFamily,
    fontSize: `${s.fontSize}pt`,
    fontWeight: s.fontWeight,
    fontStyle: s.fontStyle,
    textDecoration: s.underline ? 'underline' : 'none',
    textAlign: s.align,
    color: s.color,
    lineHeight: s.lineHeight,
    letterSpacing: `${s.letterSpacing}pt`,
    display: 'flex',
    flexDirection: 'column',
    justifyContent:
      s.valign === 'top' ? 'flex-start' : s.valign === 'middle' ? 'center' : 'flex-end',
  }
}

export function boxCss(s: BoxStyle): CSSProperties {
  return {
    background: s.background === 'transparent' ? undefined : s.background,
    border: s.borderWidth > 0 ? `${s.borderWidth}mm ${s.borderStyle} ${s.borderColor}` : undefined,
    borderRadius: `${s.borderRadius}mm`,
    padding: `${s.padding}mm`,
    opacity: s.opacity,
  }
}

/**
 * Render a resolved element's content (no interaction chrome). Shared by the
 * canvas (inside editable frames), the preview, and the print view.
 */
export function ElementContent({ el }: { el: ResolvedElement }) {
  switch (el.type) {
    case 'text':
    case 'pageNumber':
      return (
        <div style={{ ...textCss(el.textStyle), width: '100%', height: '100%', overflow: 'hidden' }}>
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{el.text}</span>
        </div>
      )
    case 'richText':
      return (
        <div
          className="rich-text-content"
          style={{ ...textCss(el.textStyle), width: '100%', height: '100%', overflow: 'hidden' }}
          dangerouslySetInnerHTML={{ __html: el.html ?? '' }}
        />
      )
    case 'image':
      return el.src ? (
        <img
          src={el.src}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: el.fit ?? 'contain', display: 'block' }}
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-black/4 text-[8pt] text-ink-3">
          No image
        </div>
      )
    case 'qr':
      return el.text ? (
        <QRCode value={el.text} size={256} style={{ width: '100%', height: '100%' }} />
      ) : (
        <div className="flex h-full w-full items-center justify-center border border-dashed border-line-2 text-[8pt] text-ink-3">
          QR
        </div>
      )
    case 'rect':
      return <div style={{ width: '100%', height: '100%' }} />
    case 'line':
      return (
        <div
          style={{
            width: '100%',
            height: 0,
            borderTop: `${Math.max(el.boxStyle.borderWidth, 0.2)}mm ${el.boxStyle.borderStyle} ${el.boxStyle.borderColor}`,
            transform: 'translateY(-50%)',
            position: 'relative',
            top: '50%',
          }}
        />
      )
    case 'divider':
      return (
        <div
          style={{
            width: '100%',
            height: 0,
            borderTop: `${Math.max(el.boxStyle.borderWidth, 0.3)}mm ${el.boxStyle.borderStyle} ${el.boxStyle.borderColor}`,
            position: 'relative',
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
      )
    case 'table': {
      const t = el.table
      if (!t || !t.columns.length) {
        return (
          <div className="flex h-full w-full items-center justify-center border border-dashed border-line-2 text-[8pt] text-ink-3">
            Table — bind a collection in the inspector
          </div>
        )
      }
      const borderColor = el.boxStyle.borderColor === '#111827' ? '#9ca3af' : el.boxStyle.borderColor
      const border = `${Math.max(el.boxStyle.borderWidth, 0.2)}mm solid ${borderColor}`
      return (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: `${el.textStyle.fontSize}pt`,
            color: el.textStyle.color,
            fontFamily: el.textStyle.fontFamily,
          }}
        >
          {t.showHeader && (
            <thead>
              <tr>
                {t.columns.map((c) => (
                  <th
                    key={c.id}
                    style={{
                      border,
                      width: `${c.widthMm}mm`,
                      height: `${t.headerHeightMm}mm`,
                      padding: '0 1.5mm',
                      textAlign: c.align,
                      fontWeight: 600,
                      background: '#f3f4f6',
                    }}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {t.rows.map((row, ri) => (
              <tr key={ri} style={t.zebra && ri % 2 ? { background: '#f9fafb' } : undefined}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      border,
                      height: `${t.rowHeightMm}mm`,
                      padding: '0 1.5mm',
                      textAlign: cell.align,
                    }}
                  >
                    {cell.text}
                  </td>
                ))}
              </tr>
            ))}
            {t.rows.length === 0 && (
              <tr>
                <td colSpan={t.columns.length} style={{ border, padding: '1.5mm', color: '#9ca3af' }}>
                  No rows — check the collection binding
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )
    }
  }
}
