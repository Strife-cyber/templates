import type { BoxStyle, TableColumn, TextStyle, VisualElement } from '../schema/template'

/**
 * Resolved rendering view-model. Produced purely from template + data context;
 * consumed by the DOM preview and the PDF exporter — never by editor state.
 */

export interface ResolvedCell {
  text: string
  align: 'left' | 'center' | 'right'
}

export interface ResolvedTable {
  columns: TableColumn[]
  showHeader: boolean
  zebra: boolean
  rowHeightMm: number
  headerHeightMm: number
  rows: ResolvedCell[][]
}

export interface ResolvedElement extends Omit<VisualElement, 'binding' | 'visibleWhen' | 'props' | 'textStyle' | 'boxStyle'> {
  /** Static or binding-resolved plain text. */
  text?: string
  /** Sanitized rich-text HTML. */
  html?: string
  /** Image source (data URI / resolved binding). */
  src?: string
  fit?: 'contain' | 'cover' | 'fill'
  table?: ResolvedTable
  textStyle: TextStyle
  boxStyle: BoxStyle
  /** Original element id for editor correlation. */
  elementId: string
}

export interface ResolvedPage {
  /** Template page id, or generated id for continuation pages. */
  id: string
  widthMm: number
  heightMm: number
  elements: ResolvedElement[]
}

export interface ResolvedDocument {
  widthMm: number
  heightMm: number
  margins: { top: number; right: number; bottom: number; left: number }
  pageCount: number
  pages: ResolvedPage[]
}
