import type { ElementType, VisualElement } from '../../core/schema/template'

export interface ElementDefault {
  w: number
  h: number
  props: Record<string, unknown>
  textStyle?: VisualElement['textStyle']
  boxStyle?: VisualElement['boxStyle']
}

export function defaultFor(type: ElementType): ElementDefault {
  switch (type) {
    case 'text':
      return {
        w: 60,
        h: 8,
        props: { text: 'Text' },
        textStyle: { fontSize: 11 },
      }
    case 'richText':
      return {
        w: 90,
        h: 24,
        props: { html: '<p>Rich text — <b>bold</b>, <i>italic</i>, lists…</p>' },
        textStyle: { fontSize: 10 },
      }
    case 'image':
      return { w: 30, h: 30, props: { src: '', fit: 'contain' }, boxStyle: { borderWidth: 0.3, borderColor: '#d1d5db' } }
    case 'rect':
      return { w: 50, h: 30, props: {}, boxStyle: { background: '#ffffff', borderWidth: 0.4, borderColor: '#111827' } }
    case 'line':
      return { w: 60, h: 1, props: {}, boxStyle: { borderWidth: 0.3, borderColor: '#111827', borderStyle: 'solid' } }
    case 'divider':
      return { w: 120, h: 1, props: {}, boxStyle: { borderWidth: 0.5, borderColor: '#111827', borderStyle: 'solid' } }
    case 'qr':
      return { w: 22, h: 22, props: { value: 'https://example.com' } }
    case 'pageNumber':
      return { w: 30, h: 6, props: { format: 'n/total' }, textStyle: { fontSize: 8, align: 'center' } }
    case 'table':
      return {
        w: 150,
        h: 40,
        props: {
          columns: [
            { id: 'c1', header: 'Column 1', widthMm: 50, align: 'left' },
            { id: 'c2', header: 'Column 2', widthMm: 50, align: 'left' },
            { id: 'c3', header: 'Column 3', widthMm: 50, align: 'right' },
          ],
          rows: { path: '' },
          showHeader: true,
          zebra: true,
          rowHeightMm: 7,
          headerHeightMm: 8,
        },
        textStyle: { fontSize: 9 },
        boxStyle: { borderWidth: 0.3, borderColor: '#9ca3af' },
      }
  }
}
