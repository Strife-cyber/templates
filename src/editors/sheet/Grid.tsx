import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useSheetEditorStore, type CellPos } from '../../store/sheetEditorStore'
import {
  a1, colName, mergeAt, colWidth, rowHeight,
} from '../../core/sheet/model'
import type { SheetCell, SheetDoc } from '../../core/schema/template'
import { clsx } from '../../utils/clsx'

const ROW_HEADER_W = 44
const COL_HEADER_H = 26

const ORIGIN_TINT: Record<string, string> = {
  source: 'bg-emerald-50',
  formula: 'bg-violet-50',
  overridden: 'bg-amber-50',
  manual: '',
}

function cellDisplay(cell: SheetCell | undefined): string {
  if (!cell) return ''
  if (cell.v === undefined || cell.v === null) return cell.f ? '#ERR!' : ''
  if (typeof cell.v === 'boolean') return cell.v ? 'TRUE' : 'FALSE'
  return String(cell.v)
}

function cellCss(cell: SheetCell | undefined): CSSProperties {
  const st = cell?.style
  return {
    fontWeight: st?.bold ? 700 : undefined,
    fontStyle: st?.italic ? 'italic' : undefined,
    textDecoration: st?.underline ? 'underline' : undefined,
    textAlign: st?.align ?? 'left',
    verticalAlign: st?.valign ?? 'middle',
    whiteSpace: st?.wrap === false ? 'nowrap' : undefined,
    fontSize: st?.fontSize ? `${st.fontSize}pt` : undefined,
    color: st?.color,
    background: st?.background,
    fontFamily: st?.fontFamily,
  }
}

function inRange(r: { r1: number; c1: number; r2: number; c2: number }, row: number, col: number) {
  return row >= r.r1 && row <= r.r2 && col >= r.c1 && col <= r.c2
}

export function SheetGrid({ onRequestRowSource }: { onRequestRowSource: () => void }) {
  const sheet = useSheetEditorStore((s) => s.template?.sheet)
  const activeCell = useSheetEditorStore((s) => s.activeCell)
  const selAnchor = useSheetEditorStore((s) => s.selAnchor)
  const editing = useSheetEditorStore((s) => s.editing)
  const editText = useSheetEditorStore((s) => s.editText)
  const store = useSheetEditorStore

  const [dragAnchor, setDragAnchor] = useState<CellPos | null>(null)
  const [colResize, setColResize] = useState<{ col: number; x0: number; w0: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const sel = selAnchor
    ? { r1: Math.min(selAnchor.row, activeCell.row), c1: Math.min(selAnchor.col, activeCell.col), r2: Math.max(selAnchor.row, activeCell.row), c2: Math.max(selAnchor.col, activeCell.col) }
    : { r1: activeCell.row, c1: activeCell.col, r2: activeCell.row, c2: activeCell.col }

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const moveActive = useCallback(
    (dr: number, dc: number, extend: boolean) => {
      const s = store.getState()
      const doc = s.template?.sheet
      if (!doc) return
      const base = extend && s.selAnchor ? s.activeCell : s.activeCell
      s.setActiveCell(
        {
          row: Math.min(doc.rowCount, Math.max(1, base.row + dr)),
          col: Math.min(doc.colCount, Math.max(1, base.col + dc)),
        },
        extend,
      )
    },
    [store],
  )

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const s = store.getState()
      if (!s.template?.sheet) return
      if (s.editing) {
        if (e.key === 'Enter') { e.preventDefault(); const r = s.editing.row, c = s.editing.col; s.commitEdit(); s.setActiveCell({ row: r + (e.shiftKey ? -1 : 1), col: c }) }
        if (e.key === 'Escape') { e.preventDefault(); s.cancelEdit() }
        if (e.key === 'Tab') { e.preventDefault(); const r = s.editing.row, c = s.editing.col; s.commitEdit(); s.setActiveCell({ row: r, col: c + (e.shiftKey ? -1 : 1) }) }
        return
      }
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? s.redo() : s.undo(); return }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); s.redo(); return }
      if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); s.selectAll(); return }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); return }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); s.clearSelection(); return }
      if (e.key === 'Enter') { e.preventDefault(); moveActive(e.shiftKey ? -1 : 1, 0, false); return }
      if (e.key === 'Tab') { e.preventDefault(); moveActive(0, e.shiftKey ? -1 : 1, false); return }
      if (e.key === 'F2') { e.preventDefault(); s.startEdit(s.activeCell); return }
      const arrows: Record<string, [number, number]> = {
        ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
      }
      const ar = arrows[e.key]
      if (ar) { e.preventDefault(); moveActive(ar[0], ar[1], e.shiftKey); return }
      // Type-to-edit: printable single char
      if (e.key.length === 1 && !mod) { s.startEdit(s.activeCell, e.key); }
    },
    [store, moveActive],
  )

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const h = (e: KeyboardEvent) => onKeyDown(e)
    el.addEventListener('keydown', h)
    return () => el.removeEventListener('keydown', h)
  }, [onKeyDown])

  // Clipboard
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onCopy = (e: ClipboardEvent) => {
      const s = store.getState()
      if (s.editing) return
      const text = s.copySelection()
      e.clipboardData?.setData('text/plain', text)
      e.preventDefault()
    }
    const onPaste = (e: ClipboardEvent) => {
      const s = store.getState()
      if (s.editing) return
      const text = e.clipboardData?.getData('text/plain')
      if (text) { s.pasteText(s.activeCell.row, s.activeCell.col, text); e.preventDefault() }
    }
    const onCut = (e: ClipboardEvent) => {
      const s = store.getState()
      if (s.editing) return
      e.clipboardData?.setData('text/plain', s.copySelection())
      s.clearSelection()
      e.preventDefault()
    }
    el.addEventListener('copy', onCopy)
    el.addEventListener('paste', onPaste)
    el.addEventListener('cut', onCut)
    return () => {
      el.removeEventListener('copy', onCopy)
      el.removeEventListener('paste', onPaste)
      el.removeEventListener('cut', onCut)
    }
  }, [store])

  // Column resize drag
  useEffect(() => {
    if (!colResize) return
    const onMove = (e: PointerEvent) => {
      const w = colResize.w0 + (e.clientX - colResize.x0)
      const s = store.getState()
      s.setColWidth(colResize.col, w)
    }
    const onUp = () => setColResize(null)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [colResize, store])

  if (!sheet) return null

  const { frozenRows, frozenCols } = sheet
  const stickyLeft = (col: number): number | undefined => {
    if (col > frozenCols) return undefined
    let x = ROW_HEADER_W
    for (let c = 1; c < col; c++) x += colWidth(sheet, c)
    return x
  }
  const stickyTop = (row: number): number | undefined => {
    if (row > frozenRows) return undefined
    let y = COL_HEADER_H
    for (let r = 1; r < row; r++) y += rowHeight(sheet, r)
    return y
  }

  const renderCell = (doc: SheetDoc, row: number, col: number) => {
    const mg = mergeAt(doc, row, col)
    if (mg && !mg.isAnchor) return null
    const cell = doc.cells[a1(row, col)]
    const isActive = activeCell.row === row && activeCell.col === col
    const isSel = inRange(sel, row, col)
    const left = stickyLeft(col)
    const top = stickyTop(row)
    const isEditing = editing?.row === row && editing?.col === col

    return (
      <td
        key={col}
        colSpan={mg ? mg.c2 - mg.c1 + 1 : 1}
        rowSpan={mg ? mg.r2 - mg.r1 + 1 : 1}
        className={clsx(
          'relative border-r border-b border-line px-1 text-[12.5px] leading-5 whitespace-pre overflow-hidden cursor-cell select-none',
          left !== undefined && 'sticky z-[5] bg-white',
          top !== undefined && 'sticky z-[6]',
          left !== undefined && top !== undefined && 'z-[7]',
          !cell?.style?.background && ORIGIN_TINT[cell?.origin ?? 'manual'],
          isSel && !isActive && 'bg-accent/8',
        )}
        style={{
          ...cellCss(cell),
          left,
          top,
          minWidth: colWidth(doc, col),
          height: rowHeight(doc, row),
          boxShadow: isActive ? 'inset 0 0 0 2px var(--color-accent)' : undefined,
          background: isSel && !isActive ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : cellCss(cell).background,
        }}
        onMouseDown={(e) => {
          if (e.button !== 0) return
          scrollRef.current?.focus()
          if (e.shiftKey) {
            store.getState().selectRange(selAnchor ?? activeCell, { row, col })
          } else {
            store.getState().setActiveCell({ row, col })
            setDragAnchor({ row, col })
          }
        }}
        onMouseEnter={() => {
          if (dragAnchor) store.getState().selectRange(dragAnchor, { row, col })
        }}
        onMouseUp={() => setDragAnchor(null)}
        onDoubleClick={() => store.getState().startEdit({ row, col })}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            className="absolute inset-0 z-10 w-full bg-white px-1 text-[12.5px] outline-none"
            value={editText}
            onChange={(e) => store.setState({ editText: e.target.value })}
            onBlur={() => store.getState().commitEdit()}
            onKeyDown={(e) => {
              // Handled here (not the grid listener): stopPropagation keeps grid
              // shortcuts out while typing; refocus the grid so they resume.
              e.stopPropagation()
              const s = store.getState()
              const { row, col } = { row: editing!.row, col: editing!.col }
              const back = () => scrollRef.current?.focus()
              if (e.key === 'Enter') {
                e.preventDefault()
                s.commitEdit()
                s.setActiveCell({ row: row + (e.shiftKey ? -1 : 1), col })
                back()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                s.cancelEdit()
                back()
              } else if (e.key === 'Tab') {
                e.preventDefault()
                s.commitEdit()
                s.setActiveCell({ row, col: col + (e.shiftKey ? -1 : 1) })
                back()
              }
            }}
          />
        ) : (
          cellDisplay(cell)
        )}
      </td>
    )
  }

  const sourceHint = sheet.rowSource
    ? `Rows bound to ${sheet.rowSource.collectionPath} from row ${sheet.rowSource.startRow}`
    : null

  return (
    <div className="flex h-full flex-col">
      {sourceHint && (
        <button
          onClick={onRequestRowSource}
          className="shrink-0 border-b border-accent/25 bg-accent/5 px-3 py-1 text-left text-[11.5px] text-accent"
        >
          {sourceHint} — click to edit binding
        </button>
      )}
      <div
        ref={scrollRef}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-auto bg-white outline-none"
        onMouseUp={() => setDragAnchor(null)}
        onMouseLeave={() => setDragAnchor(null)}
      >
        <table ref={tableRef} className="border-separate border-spacing-0">
          <thead className="sticky top-0 z-20">
            <tr>
              <th
                className="sticky left-0 z-30 border-r border-b border-line bg-chrome"
                style={{ width: ROW_HEADER_W, minWidth: ROW_HEADER_W }}
                onClick={() => store.getState().selectAll()}
              />
              {Array.from({ length: sheet.colCount }, (_, i) => i + 1).map((col) => {
                const left = stickyLeft(col)
                return (
                  <th
                    key={col}
                    className={clsx(
                      'relative border-r border-b border-line bg-chrome px-1 text-[11px] font-medium text-ink-soft',
                      left !== undefined && 'sticky z-[25]',
                      col >= sel.c1 && col <= sel.c2 && 'bg-accent/15 text-accent',
                    )}
                    style={{ left, minWidth: colWidth(sheet, col), height: COL_HEADER_H }}
                    onMouseDown={() => store.getState().selectRange({ row: 1, col }, { row: sheet.rowCount, col })}
                  >
                    {colName(col)}
                    <div
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-accent"
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        setColResize({ col, x0: e.clientX, w0: colWidth(sheet, col) })
                      }}
                    />
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: sheet.rowCount }, (_, i) => i + 1).map((row) => (
              <tr key={row}>
                <td
                  className={clsx(
                    'sticky left-0 z-10 border-r border-b border-line bg-chrome px-1 text-center text-[11px] font-medium text-ink-soft',
                    row >= sel.r1 && row <= sel.r2 && 'bg-accent/15 text-accent',
                  )}
                  style={{ minWidth: ROW_HEADER_W, height: rowHeight(sheet, row) }}
                  onMouseDown={() => store.getState().selectRange({ row, col: 1 }, { row, col: sheet.colCount })}
                >
                  {row}
                </td>
                {Array.from({ length: sheet.colCount }, (_, i) => i + 1).map((col) =>
                  renderCell(sheet, row, col),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
