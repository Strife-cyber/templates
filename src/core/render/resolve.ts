import DOMPurify from 'dompurify'
import { evaluateCondition } from '../binding/conditions'
import { resolveBinding } from '../binding/format'
import { resolvePath } from '../binding/paths'
import {
  boxStyleSchema,
  pageDimensions,
  textStyleSchema,
  type TableProps,
  type TemplateDoc,
  type VisualElement,
  type VisualPage,
} from '../schema/template'
import type { DocumentDataContext } from '../providers/types'
import type { ResolvedDocument, ResolvedElement, ResolvedPage, ResolvedTable } from './types'

const DEFAULT_TEXT = textStyleSchema.parse({})
const DEFAULT_BOX = boxStyleSchema.parse({})

/**
 * Resolve one element against the data context. Returns null when the element
 * is hidden by its visibility condition.
 */
function resolveElement(
  el: VisualElement,
  context: DocumentDataContext,
  pageIndex: number,
  pageCount: number,
): ResolvedElement | null {
  if (el.visibleWhen && !evaluateCondition(context, el.visibleWhen)) return null

  const textStyle = { ...DEFAULT_TEXT, ...(el.textStyle ?? {}) }
  const boxStyle = { ...DEFAULT_BOX, ...(el.boxStyle ?? {}) }
  const props = el.props ?? {}

  const base: ResolvedElement = {
    id: el.id,
    elementId: el.id,
    type: el.type,
    x: el.x,
    y: el.y,
    w: el.w,
    h: el.h,
    rotation: el.rotation,
    z: el.z,
    textStyle,
    boxStyle,
  }

  switch (el.type) {
    case 'text': {
      base.text = el.binding
        ? resolveBinding(context, el.binding)
        : typeof props.text === 'string'
          ? props.text
          : ''
      return base
    }
    case 'richText': {
      const raw = el.binding
        ? resolveBinding(context, el.binding)
        : typeof props.html === 'string'
          ? props.html
          : ''
      base.html = DOMPurify.sanitize(raw, {
        ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'p', 'br', 'ul', 'ol', 'li', 'span', 'a'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'style'],
      })
      return base
    }
    case 'image': {
      const bound = el.binding ? resolvePath(context, el.binding.path) : undefined
      base.src =
        typeof bound === 'string' && bound
          ? bound
          : typeof props.src === 'string'
            ? props.src
            : undefined
      base.fit = (props.fit as ResolvedElement['fit']) ?? 'contain'
      if (!base.src && !el.binding) return base // empty frame rendered as placeholder
      if (!base.src && el.binding) {
        const fb = el.binding?.fallback
        base.src = fb || undefined
      }
      return base
    }
    case 'qr': {
      base.text = el.binding
        ? resolveBinding(context, el.binding)
        : typeof props.value === 'string'
          ? props.value
          : ''
      return base
    }
    case 'pageNumber': {
      const format = typeof props.format === 'string' ? props.format : 'n'
      base.text = format
        .replace('{n}', String(pageIndex + 1))
        .replace('{total}', String(pageCount))
        .replace('n/total', `${pageIndex + 1} / ${pageCount}`)
      if (base.text === 'n') base.text = String(pageIndex + 1)
      return base
    }
    case 'table': {
      base.table = resolveTable(props, context)
      return base
    }
    default:
      return base // rect / line / divider: pure styling
  }
}

function resolveTable(props: Record<string, unknown>, context: DocumentDataContext): ResolvedTable {
  const parsed = props as unknown as TableProps
  const columns = parsed.columns ?? []
  const collectionPath = parsed.rows?.path ?? ''
  const items = resolvePath(context, collectionPath.replace(/\[\]$/, ''))
  const list = Array.isArray(items) ? items : []

  const rows = list.map((item) =>
    columns.map((col) => {
      // Column bindings are item-relative; also accept full `collection[].field`.
      let path = col.binding?.path ?? ''
      const prefix = `${collectionPath}[].`
      if (path.startsWith(prefix)) path = path.slice(prefix.length)
      else if (path.startsWith(`${collectionPath}.`)) path = path.slice(collectionPath.length + 1)
      const text = col.binding
        ? resolveBinding(item as Record<string, unknown>, { ...col.binding, path })
        : ''
      return { text, align: col.align }
    }),
  )

  return {
    columns,
    showHeader: parsed.showHeader ?? true,
    zebra: parsed.zebra ?? false,
    rowHeightMm: parsed.rowHeightMm ?? 8,
    headerHeightMm: parsed.headerHeightMm ?? 9,
    rows,
  }
}

/**
 * Paginate a resolved table across continuation pages when its rows overflow.
 * `availMm` = space remaining on the host page below the table's y.
 */
function paginateTable(
  el: ResolvedElement,
  table: ResolvedTable,
  availMm: number,
): { chunks: number[][]; consumedMm: number } {
  const header = table.showHeader ? table.headerHeightMm : 0
  const rh = table.rowHeightMm
  const fitsOnFirst = Math.max(0, Math.floor((availMm - header) / rh))
  const chunks: number[][] = []
  if (table.rows.length <= fitsOnFirst) {
    chunks.push(table.rows.map((_, i) => i))
    return { chunks, consumedMm: header + table.rows.length * rh }
  }
  if (fitsOnFirst > 0) chunks.push(table.rows.slice(0, fitsOnFirst).map((_, i) => i))
  let rest = table.rows.slice(fitsOnFirst)
  // Continuation pages get the full content height (recomputed by caller).
  const perPage = Math.max(1, Math.floor((availMm + el.y - header) / rh))
  while (rest.length) {
    chunks.push(rest.slice(0, perPage).map((_, i) => i + table.rows.length - rest.length))
    rest = rest.slice(perPage)
  }
  const lastChunk = chunks[chunks.length - 1]!
  return {
    chunks,
    consumedMm: header + lastChunk.length * rh, // consumed on the LAST page
  }
}

/**
 * The full pipeline: validate (caller) → resolve bindings → expand collections
 * → paginate overflowing tables → resolved pages.
 */
export function resolveVisualDocument(
  template: TemplateDoc,
  context: DocumentDataContext,
): ResolvedDocument {
  const dims = pageDimensions(template.page)
  const { margins } = template.page
  const contentW = dims.widthMm - margins.left - margins.right
  const contentH = dims.heightMm - margins.top - margins.bottom
  void contentW

  // First pass: resolve elements per template page (pageCount unknown yet — use
  // a placeholder, then re-resolve page-number elements once pagination is done).
  const rawPages: VisualPage[] = template.pages ?? []
  const outPages: ResolvedPage[] = []

  for (const page of rawPages) {
    const sorted = [...page.elements].sort((a, b) => a.z - b.z || a.y - b.y)
    const resolved: (ResolvedElement | null)[] = sorted.map((el) =>
      resolveElement(el, context, 0, 1),
    )

    const host: ResolvedElement[] = []
    const continuations: ResolvedPage[] = []
    // Elements below an overflowing table move to its last continuation page.
    const deferred: { el: ResolvedElement; relY: number }[] = []
    let overflowBottom: number | null = null

    for (const el of resolved) {
      if (!el) continue

      if (overflowBottom !== null && el.y >= overflowBottom) {
        deferred.push({ el, relY: el.y - overflowBottom })
        continue
      }

      if (el.type === 'table' && el.table && el.table.rows.length > 0) {
        const avail = contentH - el.y
        const { chunks, consumedMm } = paginateTable(el, el.table, avail)
        const header = el.table.showHeader ? el.table.headerHeightMm : 0
        if (chunks.length > 1) {
          host.push({
            ...el,
            h: header + chunks[0]!.length * el.table.rowHeightMm,
            table: { ...el.table, rows: chunks[0]!.map((i) => el.table!.rows[i]!) },
          })
          overflowBottom = el.y + header + chunks[0]!.length * el.table.rowHeightMm
          chunks.slice(1).forEach((idxs, ci) => {
            const contPage: ResolvedPage = {
              id: `${page.id}__cont${ci}`,
              widthMm: dims.widthMm,
              heightMm: dims.heightMm,
              elements: [
                {
                  ...el,
                  y: 0,
                  h: header + idxs.length * el.table!.rowHeightMm,
                  table: { ...el.table!, rows: idxs.map((i) => el.table!.rows[i]!) },
                },
              ],
            }
            continuations.push(contPage)
          })
          void consumedMm
          continue
        }
        host.push({ ...el, h: header + el.table.rows.length * el.table.rowHeightMm })
        continue
      }
      host.push(el)
    }

    outPages.push({
      id: page.id,
      widthMm: dims.widthMm,
      heightMm: dims.heightMm,
      elements: host,
    })
    outPages.push(...continuations)

    if (deferred.length) {
      const last = continuations.at(-1)
      if (last) {
        const lastTable = last.elements[0]
        const consumed = lastTable ? lastTable.y + lastTable.h : 0
        for (const d of deferred) {
          last.elements.push({ ...d.el, y: consumed + 4 + d.relY })
        }
      } else {
        outPages.at(-1)!.elements.push(...deferred.map((d) => d.el))
      }
    }
  }

  const pageCount = outPages.length

  // Re-resolve page-number elements with real indices.
  for (const [pi, page] of outPages.entries()) {
    for (const el of page.elements) {
      if (el.type === 'pageNumber') {
        const original = rawPages.flatMap((p) => p.elements).find((e) => e.id === el.elementId)
        const fmt = (original?.props?.format as string) ?? 'n/total'
        el.text = fmt
          .replace('{n}', String(pi + 1))
          .replace('{total}', String(pageCount))
          .replace(/^n\/total$/, `${pi + 1} / ${pageCount}`)
          .replace(/^n$/, String(pi + 1))
      }
    }
  }

  return {
    widthMm: dims.widthMm,
    heightMm: dims.heightMm,
    margins,
    pageCount,
    pages: outPages,
  }
}
