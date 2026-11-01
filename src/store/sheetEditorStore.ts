import { create } from 'zustand'
import type { SheetDoc, TemplateDoc, RowSource } from '../core/schema/template'
import type { DocumentDataContext } from '../core/providers/types'
import { dexieRepository } from '../persistence/templateRepository'
import {
  a1, parseA1, parseRange, colIndex, colName, getCell, setCell,
} from '../core/sheet/model'
// colName used by SheetToolbar cell-range label; re-exported below for convenience.
export { colName }
import { evaluateSheet, setCellContent, formulaRefs, type CellValue } from '../core/sheet/formula'
import { resolvePath } from '../core/binding/paths'

const MAX_HISTORY = 80
const AUTOSAVE_MS = 800

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface CellPos {
  row: number
  col: number
}

export interface SheetEditorState {
  template: TemplateDoc | null
  scenarioId: string | null
  recordId: string | null
  context: DocumentDataContext | null

  activeCell: CellPos
  selAnchor: CellPos | null
  editing: CellPos | null
  editText: string

  dirty: boolean
  saveState: SaveState
  history: { past: SheetDoc[]; future: SheetDoc[]; lastKey: string | null }

  load: (id: string) => Promise<void>
  unload: () => void
  setContext: (scenarioId: string, recordId: string, context: DocumentDataContext) => void
  mutate: (fn: (sheet: SheetDoc) => void, historyKey?: string) => void
  undo: () => void
  redo: () => void
  save: () => Promise<void>

  setActiveCell: (pos: CellPos, extend?: boolean) => void
  selectRange: (anchor: CellPos, head: CellPos) => void
  selectAll: () => void
  startEdit: (pos: CellPos, initial?: string) => void
  commitEdit: () => void
  cancelEdit: () => void
  setCellValue: (row: number, col: number, raw: string) => void
  applyStyle: (patch: Partial<NonNullable<import('../core/schema/template').SheetCell['style']>>) => void
  clearSelection: () => void

  insertRow: (at: number, count?: number) => void
  deleteRow: (at: number, count?: number) => void
  insertCol: (at: number, count?: number) => void
  deleteCol: (at: number, count?: number) => void
  mergeRange: () => void
  unmergeAt: (row: number, col: number) => void
  setColWidth: (col: number, w: number) => void
  setRowHeight: (row: number, h: number) => void
  setPrint: (patch: Partial<SheetDoc['print']>) => void

  setRowSource: (source: RowSource | null) => void
  applyRowSource: () => void
  recalc: () => void

  copySelection: () => string
  pasteText: (row: number, col: number, text: string) => void
  currentEditValue: () => string
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

const clone = (s: SheetDoc): SheetDoc => JSON.parse(JSON.stringify(s)) as SheetDoc

function selRange(a: CellPos, b: CellPos) {
  return {
    r1: Math.min(a.row, b.row),
    c1: Math.min(a.col, b.col),
    r2: Math.max(a.row, b.row),
    c2: Math.max(a.col, b.col),
  }
}

export const useSheetEditorStore = create<SheetEditorState>((set, get) => {
  const pushHistory = (key?: string) => {
    const s = get()
    const sheet = s.template?.sheet
    if (!sheet) return
    const history = { ...s.history }
    if (key && key === history.lastKey) {
      history.past = [...history.past.slice(1)]
    } else {
      history.past = [...history.past.slice(-MAX_HISTORY + 1), clone(sheet)]
      history.future = []
    }
    history.lastKey = key ?? null
    set({ history })
  }

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void get().save(), AUTOSAVE_MS)
  }

  return {
    template: null,
    scenarioId: null,
    recordId: null,
    context: null,
    activeCell: { row: 1, col: 1 },
    selAnchor: null,
    editing: null,
    editText: '',
    dirty: false,
    saveState: 'idle',
    history: { past: [], future: [], lastKey: null },

    load: async (id) => {
      const tpl = await dexieRepository.get(id)
      if (!tpl?.sheet) return
      const sheet = clone(tpl.sheet)
      evaluateSheet(sheet)
      set({
        template: { ...tpl, sheet },
        activeCell: { row: 1, col: 1 },
        selAnchor: null,
        editing: null,
        history: { past: [], future: [], lastKey: null },
        dirty: false,
      })
    },

    unload: () => {
      if (saveTimer) clearTimeout(saveTimer)
      set({ template: null, context: null, editing: null, dirty: false })
    },

    setContext: (scenarioId, recordId, context) => {
      set({ scenarioId, recordId, context })
      get().applyRowSource()
    },

    mutate: (fn, historyKey) => {
      const s = get()
      if (!s.template?.sheet) return
      pushHistory(historyKey)
      const sheet = clone(s.template.sheet)
      fn(sheet)
      evaluateSheet(sheet)
      set({ template: { ...s.template, sheet }, dirty: true })
      scheduleSave()
    },

    undo: () => {
      const s = get()
      const sheet = s.template?.sheet
      const prev = s.history.past.at(-1)
      if (!sheet || !prev) return
      const next = clone(prev)
      evaluateSheet(next)
      set({
        template: { ...s.template!, sheet: next },
        history: {
          past: s.history.past.slice(0, -1),
          future: [...s.history.future, clone(sheet)],
          lastKey: null,
        },
        dirty: true,
      })
      scheduleSave()
    },

    redo: () => {
      const s = get()
      const sheet = s.template?.sheet
      const next = s.history.future.at(-1)
      if (!sheet || !next) return
      const restored = clone(next)
      evaluateSheet(restored)
      set({
        template: { ...s.template!, sheet: restored },
        history: {
          past: [...s.history.past, clone(sheet)],
          future: s.history.future.slice(0, -1),
          lastKey: null,
        },
        dirty: true,
      })
      scheduleSave()
    },

    save: async () => {
      const s = get()
      if (!s.template) return
      set({ saveState: 'saving' })
      try {
        await dexieRepository.put({ ...s.template, updatedAt: new Date().toISOString() })
        set({ saveState: 'saved', dirty: false })
      } catch {
        set({ saveState: 'error' })
      }
    },

    setActiveCell: (pos, extend) => {
      const s = get()
      set({
        activeCell: pos,
        selAnchor: extend ? (s.selAnchor ?? s.activeCell) : null,
      })
    },

    selectRange: (anchor, head) => set({ activeCell: head, selAnchor: anchor }),
    selectAll: () => {
      const doc = get().template?.sheet
      if (!doc) return
      set({ selAnchor: { row: 1, col: 1 }, activeCell: { row: doc.rowCount, col: doc.colCount } })
    },

    startEdit: (pos, initial) => {
      const cell = get().template?.sheet?.cells[a1(pos.row, pos.col)]
      const text =
        initial ??
        (cell?.f ? `=${cell.f}` : cell?.v !== undefined ? String(cell.v) : '')
      set({ editing: pos, editText: text })
    },

    commitEdit: () => {
      const s = get()
      if (!s.editing) return
      get().setCellValue(s.editing.row, s.editing.col, s.editText)
      set({ editing: null, editText: '' })
    },

    cancelEdit: () => set({ editing: null, editText: '' }),

    setCellValue: (row, col, raw) => {
      get().mutate((sheet) => setCellContent(sheet, row, col, raw), `cell:${row}:${col}`)
    },

    applyStyle: (patch) => {
      const s = get()
      if (!s.template?.sheet) return
      const r = s.selAnchor ? selRange(s.selAnchor, s.activeCell) : { r1: s.activeCell.row, c1: s.activeCell.col, r2: s.activeCell.row, c2: s.activeCell.col }
      s.mutate((sheet) => {
        for (let row = r.r1; row <= r.r2; row++) {
          for (let col = r.c1; col <= r.c2; col++) {
            const existing = getCell(sheet, row, col)
            const style = { ...(existing?.style ?? {}), ...patch }
            // Strip undefined keys so "clear" works via undefined values.
            for (const k of Object.keys(style)) {
              if ((style as Record<string, unknown>)[k] === undefined) delete (style as Record<string, unknown>)[k]
            }
            if (existing) setCell(sheet, row, col, { ...existing, style })
            else setCell(sheet, row, col, { origin: 'manual', style })
          }
        }
      }, 'style')
    },

    clearSelection: () => {
      const s = get()
      const r = s.selAnchor ? selRange(s.selAnchor, s.activeCell) : { r1: s.activeCell.row, c1: s.activeCell.col, r2: s.activeCell.row, c2: s.activeCell.col }
      s.mutate((sheet) => {
        for (let row = r.r1; row <= r.r2; row++)
          for (let col = r.c1; col <= r.c2; col++) setCell(sheet, row, col, undefined)
      })
    },

    insertRow: (at, count = 1) => {
      get().mutate((sheet) => {
        const moved: Record<string, typeof sheet.cells[string]> = {}
        for (const [key, cell] of Object.entries(sheet.cells)) {
          const p = parseA1(key)!
          moved[p.row >= at ? a1(p.row + count, p.col) : key] = cell
        }
        sheet.cells = moved
        const rh: Record<string, number> = {}
        for (const [k, v] of Object.entries(sheet.rowHeights)) {
          const n = Number(k)
          rh[String(n >= at ? n + count : n)] = v
        }
        sheet.rowHeights = rh
        sheet.rowCount += count
        sheet.merges = sheet.merges
          .map((m) => {
            const r = parseRange(`${m.start}:${m.end}`)!
            if (r.r1 >= at) return { start: a1(r.r1 + count, r.c1), end: a1(r.r2 + count, r.c2) }
            if (r.r2 >= at) return { start: m.start, end: a1(r.r2 + count, r.c2) }
            return m
          })
        if (sheet.rowSource && sheet.rowSource.startRow >= at) {
          sheet.rowSource = { ...sheet.rowSource, startRow: sheet.rowSource.startRow + count }
        }
      })
    },

    deleteRow: (at, count = 1) => {
      get().mutate((sheet) => {
        const moved: Record<string, typeof sheet.cells[string]> = {}
        for (const [key, cell] of Object.entries(sheet.cells)) {
          const p = parseA1(key)!
          if (p.row >= at && p.row < at + count) continue
          moved[p.row >= at + count ? a1(p.row - count, p.col) : key] = cell
        }
        sheet.cells = moved
        sheet.rowCount = Math.max(at, sheet.rowCount - count)
        const rh: Record<string, number> = {}
        for (const [k, v] of Object.entries(sheet.rowHeights)) {
          const n = Number(k)
          if (n >= at && n < at + count) continue
          rh[String(n >= at + count ? n - count : n)] = v
        }
        sheet.rowHeights = rh
        sheet.merges = sheet.merges.filter((m) => {
          const r = parseRange(`${m.start}:${m.end}`)!
          return !(r.r1 >= at && r.r2 < at + count)
        }).map((m) => {
          const r = parseRange(`${m.start}:${m.end}`)!
          if (r.r1 >= at + count) return { start: a1(r.r1 - count, r.c1), end: a1(r.r2 - count, r.c2) }
          if (r.r2 >= at + count) return { start: m.start, end: a1(r.r2 - count, r.c2) }
          return m
        })
      })
    },

    insertCol: (at, count = 1) => {
      get().mutate((sheet) => {
        const moved: Record<string, typeof sheet.cells[string]> = {}
        for (const [key, cell] of Object.entries(sheet.cells)) {
          const p = parseA1(key)!
          moved[p.col >= at ? a1(p.row, p.col + count) : key] = cell
        }
        sheet.cells = moved
        const cw: Record<string, number> = {}
        for (const [k, v] of Object.entries(sheet.colWidths)) {
          const col = Number(k)
          cw[String(col >= at ? col + count : col)] = v
        }
        sheet.colWidths = cw
        sheet.colCount += count
        sheet.merges = sheet.merges.map((m) => {
          const r = parseRange(`${m.start}:${m.end}`)!
          if (r.c1 >= at) return { start: a1(r.r1, r.c1 + count), end: a1(r.r2, r.c2 + count) }
          if (r.c2 >= at) return { start: m.start, end: a1(r.r2, r.c2 + count) }
          return m
        })
      })
    },

    deleteCol: (at, count = 1) => {
      get().mutate((sheet) => {
        const moved: Record<string, typeof sheet.cells[string]> = {}
        for (const [key, cell] of Object.entries(sheet.cells)) {
          const p = parseA1(key)!
          if (p.col >= at && p.col < at + count) continue
          moved[p.col >= at + count ? a1(p.row, p.col - count) : key] = cell
        }
        sheet.cells = moved
        sheet.colCount = Math.max(at, sheet.colCount - count)
        const cw: Record<string, number> = {}
        for (const [k, v] of Object.entries(sheet.colWidths)) {
          const col = Number(k)
          if (col >= at && col < at + count) continue
          cw[String(col >= at + count ? col - count : col)] = v
        }
        sheet.colWidths = cw
        sheet.merges = sheet.merges.filter((m) => {
          const r = parseRange(`${m.start}:${m.end}`)!
          return !(r.c1 >= at && r.c2 < at + count)
        }).map((m) => {
          const r = parseRange(`${m.start}:${m.end}`)!
          if (r.c1 >= at + count) return { start: a1(r.r1, r.c1 - count), end: a1(r.r2, r.c2 - count) }
          if (r.c2 >= at + count) return { start: m.start, end: a1(r.r2, r.c2 - count) }
          return m
        })
      })
    },

    mergeRange: () => {
      const s = get()
      const anchor = s.selAnchor
      if (!anchor) return
      const r = selRange(anchor, s.activeCell)
      if (r.r1 === r.r2 && r.c1 === r.c2) return
      s.mutate((sheet) => {
        // Drop merges fully inside the range; move top-left value into anchor.
        const start = a1(r.r1, r.c1)
        const tl = getCell(sheet, r.r1, r.c1)
        sheet.merges = sheet.merges.filter((m) => {
          const mr = parseRange(`${m.start}:${m.end}`)!
          return !(mr.r1 >= r.r1 && mr.r2 <= r.r2 && mr.c1 >= r.c1 && mr.c2 <= r.c2)
        })
        for (let row = r.r1; row <= r.r2; row++)
          for (let col = r.c1; col <= r.c2; col++)
            if (row !== r.r1 || col !== r.c1) setCell(sheet, row, col, undefined)
        if (tl) setCell(sheet, r.r1, r.c1, tl)
        sheet.merges.push({ start, end: a1(r.r2, r.c2) })
      })
    },

    unmergeAt: (row, col) => {
      get().mutate((sheet) => {
        sheet.merges = sheet.merges.filter((m) => {
          const r = parseRange(`${m.start}:${m.end}`)!
          return !(row >= r.r1 && row <= r.r2 && col >= r.c1 && col <= r.c2)
        })
      })
    },

    setColWidth: (col, w) => {
      get().mutate((sheet) => {
        sheet.colWidths[String(col)] = Math.max(24, Math.round(w))
      }, `colw:${col}`)
    },

    setRowHeight: (row, h) => {
      get().mutate((sheet) => {
        sheet.rowHeights[String(row)] = Math.max(16, Math.round(h))
      }, `rowh:${row}`)
    },

    setPrint: (patch) => {
      get().mutate((sheet) => {
        sheet.print = { ...sheet.print, ...patch }
      })
    },

    setRowSource: (source) => {
      get().mutate((sheet) => {
        sheet.rowSource = source
      })
    },

    // Kept simple: rowSource is nullable in the schema.

    applyRowSource: () => {
      const s = get()
      const sheet = s.template?.sheet
      const rs = sheet?.rowSource
      const ctx = s.context
      if (!sheet || !rs || !ctx) return
      const items = resolvePath(ctx, rs.collectionPath.replace(/\[\]$/, ''))
      const list = Array.isArray(items) ? items : []

      s.mutate((sh) => {
        // Clear previous source-bound cells in the mapped columns below startRow.
        const cols = Object.keys(rs.mapping).map(colIndex).filter((c) => c > 0)
        for (const [key, cell] of Object.entries(sh.cells)) {
          if (cell.origin === 'source' || cell.origin === 'overridden') {
            const p = parseA1(key)!
            if (p.row >= rs.startRow && cols.includes(p.col) && cell.origin === 'source') {
              delete sh.cells[key]
            }
          }
        }
        list.forEach((item, i) => {
          const row = rs.startRow + i
          if (row > sh.rowCount) sh.rowCount = row
          for (const [colLetter, path] of Object.entries(rs.mapping)) {
            const col = colIndex(colLetter)
            if (col <= 0) continue
            const existing = getCell(sh, row, col)
            // Never clobber a user's manual/override edit.
            if (existing && (existing.origin === 'manual' || existing.origin === 'formula' || existing.origin === 'overridden')) continue
            const raw = resolvePath(item, path.replace(/^[A-Za-z0-9_]+\[\]\./, '').replace(/^item\./, ''))
            const v: CellValue =
              typeof raw === 'number' ? raw : raw == null ? '' : typeof raw === 'boolean' ? raw : String(raw)
            setCell(sh, row, col, { v, origin: 'source', b: `{$${path}}` })
          }
        })
      })
    },

    recalc: () => {
      const s = get()
      if (!s.template?.sheet) return
      const sheet = clone(s.template.sheet)
      evaluateSheet(sheet)
      set({ template: { ...s.template, sheet } })
    },

    copySelection: () => {
      const s = get()
      const sheet = s.template?.sheet
      if (!sheet) return ''
      const r = s.selAnchor ? selRange(s.selAnchor, s.activeCell) : { r1: s.activeCell.row, c1: s.activeCell.col, r2: s.activeCell.row, c2: s.activeCell.col }
      const lines: string[] = []
      for (let row = r.r1; row <= r.r2; row++) {
        const vals: string[] = []
        for (let col = r.c1; col <= r.c2; col++) {
          const cell = getCell(sheet, row, col)
          vals.push(cell?.f ? `=${cell.f}` : cell?.v !== undefined ? String(cell.v) : '')
        }
        lines.push(vals.join('\t'))
      }
      return lines.join('\n')
    },

    pasteText: (row, col, text) => {
      get().mutate((sheet) => {
        const rows = text.replace(/\r/g, '').split('\n')
        rows.forEach((line, ri) => {
          if (line === '' && ri === rows.length - 1) return
          line.split('\t').forEach((raw, ci) => {
            setCellContent(sheet, row + ri, col + ci, raw, 'manual')
          })
        })
      })
    },

    currentEditValue: () => {
      const s = get()
      if (!s.editing) return ''
      return s.editText
    },
  }
})

/** Keep TypeScript happy about formulaRefs being part of the public surface. */
export { formulaRefs }
