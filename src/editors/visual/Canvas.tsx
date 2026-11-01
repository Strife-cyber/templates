import { useDroppable } from '@dnd-kit/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { resolveVisualDocument } from '../../core/render/resolve'
import type { ResolvedElement } from '../../core/render/types'
import type { VisualElement } from '../../core/schema/template'
import { useVisualEditorStore } from '../../store/visualEditorStore'
import { MM_TO_PX, ElementContent, boxCss } from './ElementContent'
import { roundMm, snapRect, type Guide, type Rect } from './guides'
import { RichTextEditor } from './RichTextEditor'

type DragMode =
  | { kind: 'move'; startX: number; startY: number; origins: Map<string, Rect> }
  | { kind: 'resize'; startX: number; startY: number; origin: Rect; handle: string; id: string }
  | { kind: 'marquee'; startX: number; startY: number }

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const

export function Canvas() {
  const {
    template,
    pageIndex,
    zoom,
    context,
    selectedIds,
    showGrid,
    snap,
    select,
    clearSelection,
    updateElement,
    mutate,
    deleteSelected,
    duplicateSelected,
    undo,
    redo,
    addPage,
    removePage,
    setPageIndex,
  } = useVisualEditorStore()

  const resolved = useMemo(
    () => (template ? resolveVisualDocument(template, context) : null),
    [template, context],
  )
  const [guides, setGuides] = useState<Guide[]>([])
  const [marquee, setMarquee] = useState<Rect | null>(null)
  const [editingText, setEditingText] = useState<string | null>(null)
  const dragRef = useRef<DragMode | null>(null)

  const pages = template?.pages ?? []
  const resolvedPage = resolved?.pages[pageIndex]
  const templatePage = pages[pageIndex]

  const pageW = resolved?.widthMm ?? 210
  const pageH = resolved?.heightMm ?? 297
  const margins = resolved?.margins ?? { top: 10, right: 10, bottom: 10, left: 10 }
  const scale = MM_TO_PX * zoom

  const resolvedById = useMemo(() => {
    const m = new Map<string, ResolvedElement>()
    resolvedPage?.elements.forEach((e) => m.set(e.elementId, e))
    return m
  }, [resolvedPage])

  // ------------------------------------------------------------------
  // Keyboard
  // ------------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if ((mod && e.key.toLowerCase() === 'y') || (mod && e.shiftKey && e.key.toLowerCase() === 'z')) { e.preventDefault(); redo() }
      else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected() }
      else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        select(templatePage?.elements.map((el) => el.id) ?? [])
      } else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected()
      else if (e.key === 'Escape') { clearSelection(); setEditingText(null) }
      else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedIds.length) {
        e.preventDefault()
        const d = e.shiftKey ? 1 : 0.5
        const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0
        const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0
        mutate((pages) => {
          for (const page of pages)
            for (const el of page.elements)
              if (selectedIds.includes(el.id)) { el.x += dx; el.y += dy }
        }, `nudge:${selectedIds.join(',')}`)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds, templatePage, undo, redo, deleteSelected, duplicateSelected, clearSelection, mutate, select])

  // ------------------------------------------------------------------
  // Drag logic (pointer events on the page surface)
  // ------------------------------------------------------------------
  const pageClientToMm = useCallback(
    (clientX: number, clientY: number, pageEl: HTMLElement | null): { x: number; y: number } => {
      if (!pageEl) return { x: 0, y: 0 }
      const r = pageEl.getBoundingClientRect()
      return {
        x: (clientX - r.left) / scale - margins.left,
        y: (clientY - r.top) / scale - margins.top,
      }
    },
    [scale, margins],
  )

  const onElementPointerDown = (e: ReactPointerEvent, el: VisualElement, pageEl: HTMLElement) => {
    if (e.button !== 0 || editingText) return
    e.stopPropagation()
    const additive = e.shiftKey
    if (!selectedIds.includes(el.id)) select([el.id], additive)
    else if (additive) select(selectedIds.filter((id) => id !== el.id))
    const ids = selectedIds.includes(el.id) ? selectedIds : [el.id]
    const origins = new Map<string, Rect>()
    for (const p of pages) {
      for (const item of p.elements) {
        if (ids.includes(item.id)) origins.set(item.id, { x: item.x, y: item.y, w: item.w, h: item.h })
      }
    }
    const pt = pageClientToMm(e.clientX, e.clientY, pageEl)
    dragRef.current = { kind: 'move', startX: pt.x, startY: pt.y, origins }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onHandlePointerDown = (e: ReactPointerEvent, el: VisualElement, handle: string, pageEl: HTMLElement) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const pt = pageClientToMm(e.clientX, e.clientY, pageEl)
    dragRef.current = { kind: 'resize', startX: pt.x, startY: pt.y, origin: { x: el.x, y: el.y, w: el.w, h: el.h }, handle, id: el.id }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPagePointerMove = (e: ReactPointerEvent, pageEl: HTMLElement) => {
    const drag = dragRef.current
    if (!drag) return
    const pt = pageClientToMm(e.clientX, e.clientY, pageEl)
    const dx = pt.x - drag.startX
    const dy = pt.y - drag.startY

    if (drag.kind === 'marquee') {
      setMarquee({ x: Math.min(drag.startX, pt.x), y: Math.min(drag.startY, pt.y), w: Math.abs(dx), h: Math.abs(dy) })
      return
    }

    if (drag.kind === 'move') {
      const first = drag.origins.entries().next().value as [string, Rect] | undefined
      if (!first) return
      const others: Rect[] = []
      for (const p of pages) for (const el of p.elements) if (!drag.origins.has(el.id)) others.push(el)
      const moved: Rect = { x: first[1].x + dx, y: first[1].y + dy, w: first[1].w, h: first[1].h }
      const snapped = snapRect(moved, others, { w: pageW - margins.left - margins.right, h: pageH - margins.top - margins.bottom }, snap)
      setGuides(snapped.guides)
      mutate((pgs) => {
        for (const page of pgs)
          for (const el of page.elements) {
            const o = drag.origins.get(el.id)
            if (o) {
              el.x = roundMm(o.x + dx + (el.id === first[0] ? snapped.dx : 0))
              el.y = roundMm(o.y + dy + (el.id === first[0] ? snapped.dy : 0))
            }
          }
      }, `move:${[...drag.origins.keys()].join(',')}`)
      return
    }

    if (drag.kind === 'resize') {
      const o = drag.origin
      let { x, y, w, h } = o
      if (drag.handle.includes('e')) w = o.w + dx
      if (drag.handle.includes('s')) h = o.h + dy
      if (drag.handle.includes('w')) { w = o.w - dx; x = o.x + dx }
      if (drag.handle.includes('n')) { h = o.h - dy; y = o.y + dy }
      w = Math.max(2, w)
      h = Math.max(1, h)
      if (drag.handle.includes('w')) x = Math.min(x, o.x + o.w - 2)
      if (drag.handle.includes('n')) y = Math.min(y, o.y + o.h - 1)
      updateElement(drag.id, { x: roundMm(x), y: roundMm(y), w: roundMm(w), h: roundMm(h) }, `resize:${drag.id}`)
    }
  }

  const onPointerUp = () => {
    if (dragRef.current?.kind === 'marquee' && marquee && templatePage) {
      const hits = templatePage.elements
        .filter((el) => el.x < marquee.x + marquee.w && el.x + el.w > marquee.x && el.y < marquee.y + marquee.h && el.y + el.h > marquee.y)
        .map((el) => el.id)
      select(hits)
    }
    dragRef.current = null
    setMarquee(null)
    setGuides([])
  }

  const onPageBackgroundPointerDown = (e: ReactPointerEvent, pageEl: HTMLElement) => {
    if (e.button !== 0) return
    const pt = pageClientToMm(e.clientX, e.clientY, pageEl)
    dragRef.current = { kind: 'marquee', startX: pt.x, startY: pt.y }
    if (!e.shiftKey) clearSelection()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onElementDoubleClick = (el: VisualElement) => {
    if (el.type === 'text' || el.type === 'richText') setEditingText(el.id)
  }

  // ------------------------------------------------------------------
  const gridBg = showGrid
    ? `repeating-linear-gradient(0deg, transparent, transparent ${5 * scale - 1}px, rgba(0,0,0,0.045) ${5 * scale - 1}px, rgba(0,0,0,0.045) ${5 * scale}px),
       repeating-linear-gradient(90deg, transparent, transparent ${5 * scale - 1}px, rgba(0,0,0,0.045) ${5 * scale - 1}px, rgba(0,0,0,0.045) ${5 * scale}px)`
    : undefined

  return (
    <div className="flex h-full flex-col overflow-auto bg-chrome" onPointerUp={onPointerUp}>
      <div className="flex min-h-full flex-col items-center gap-6 p-8">
        {pages.map((page, i) => (
          <PageView
            key={page.id}
            index={i}
            active={i === pageIndex}
            pageW={pageW}
            pageH={pageH}
            margins={margins}
            scale={scale}
            gridBg={gridBg}
            elements={page.elements}
            resolvedById={resolvedById}
            selectedIds={selectedIds}
            guides={i === pageIndex ? guides : []}
            marquee={marquee}
            editingText={editingText}
            onActivate={() => setPageIndex(i)}
            onRemove={() => removePage(i)}
            canRemove={pages.length > 1}
            onElementPointerDown={onElementPointerDown}
            onHandlePointerDown={onHandlePointerDown}
            onBackgroundPointerDown={onPageBackgroundPointerDown}
            onPointerMove={onPagePointerMove}
            onElementDoubleClick={onElementDoubleClick}
            onEditDone={() => setEditingText(null)}
          />
        ))}
        <button
          onClick={addPage}
          className="rounded-lg border border-dashed border-line-2 px-4 py-2 text-xs text-ink-3 hover:border-accent hover:text-accent-2"
        >
          + Add page
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// One page surface
// ---------------------------------------------------------------------------

function PageView(props: {
  index: number
  active: boolean
  pageW: number
  pageH: number
  margins: { top: number; right: number; bottom: number; left: number }
  scale: number
  gridBg?: string
  elements: VisualElement[]
  resolvedById: Map<string, ResolvedElement>
  selectedIds: string[]
  guides: Guide[]
  marquee: Rect | null
  editingText: string | null
  canRemove: boolean
  onActivate: () => void
  onRemove: () => void
  onElementPointerDown: (e: ReactPointerEvent, el: VisualElement, pageEl: HTMLElement) => void
  onHandlePointerDown: (e: ReactPointerEvent, el: VisualElement, handle: string, pageEl: HTMLElement) => void
  onBackgroundPointerDown: (e: ReactPointerEvent, pageEl: HTMLElement) => void
  onPointerMove: (e: ReactPointerEvent, pageEl: HTMLElement) => void
  onElementDoubleClick: (el: VisualElement) => void
  onEditDone: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { setNodeRef, isOver } = useDroppable({ id: `page-${props.index}` })
  const { margins, scale } = props
  const contentW = props.pageW - margins.left - margins.right
  const contentH = props.pageH - margins.top - margins.bottom

  return (
    <div
      ref={(n) => {
        ref.current = n
        setNodeRef(n)
      }}
      data-page-index={props.index}
      onPointerDown={props.onActivate}
      className={`relative shrink-0 bg-white shadow-[0_2px_16px_rgba(0,0,0,0.12)] transition-shadow ${
        props.active ? 'ring-2 ring-accent/60' : ''
      } ${isOver ? 'ring-2 ring-blue-400' : ''}`}
      style={{ width: props.pageW * scale, height: props.pageH * scale }}
    >
      {/* content box = margins applied */}
      <div
        className="absolute overflow-hidden"
        style={{
          left: margins.left * scale,
          top: margins.top * scale,
          width: contentW * scale,
          height: contentH * scale,
          background: props.gridBg,
        }}
        onPointerDown={(e) => ref.current && props.onBackgroundPointerDown(e, ref.current)}
        onPointerMove={(e) => ref.current && props.onPointerMove(e, ref.current)}
      >
        {props.elements
          .slice()
          .sort((a, b) => a.z - b.z)
          .map((el) => {
            const res = props.resolvedById.get(el.id)
            const selected = props.selectedIds.includes(el.id)
            const editing = props.editingText === el.id
            return (
              <div
                key={el.id}
                data-element-id={el.id}
                className="absolute"
                style={{
                  left: el.x * scale,
                  top: el.y * scale,
                  width: el.w * scale,
                  height: el.h * scale,
                  transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                  ...boxCss({ borderWidth: 0, borderColor: '#111827', borderStyle: 'solid', borderRadius: 0, padding: 0, background: 'transparent', opacity: res?.boxStyle.opacity ?? 1 }),
                }}
                onPointerDown={(e) => ref.current && props.onElementPointerDown(e, el, ref.current)}
                onDoubleClick={() => props.onElementDoubleClick(el)}
              >
                {/* actual content */}
                <div
                  className="h-full w-full"
                  style={res ? boxCss(res.boxStyle) : undefined}
                >
                  {editing && el.type === 'text' ? (
                    <InlineTextEditor el={el} scale={scale} onDone={props.onEditDone} />
                  ) : editing && el.type === 'richText' ? (
                    <RichTextEditor el={el} onDone={props.onEditDone} />
                  ) : res ? (
                    <ElementContent el={res} />
                  ) : null}
                </div>

                {/* selection chrome */}
                {selected && !editing && (
                  <div className="pointer-events-none absolute inset-0 border-1 border-accent outline outline-[0.5px] outline-accent" style={{ borderWidth: 1 }} />
                )}
                {selected && !editing && props.selectedIds.length === 1 &&
                  HANDLES.map((h) => <Handle key={h} pos={h} onPointerDown={(e) => ref.current && props.onHandlePointerDown(e, el, h, ref.current)} />)}
              </div>
            )
          })}

        {/* guides */}
        {props.guides.map((g, i) =>
          g.axis === 'x' ? (
            <div key={i} className="pointer-events-none absolute top-0 bottom-0 w-px bg-pink-500" style={{ left: g.pos * scale }} />
          ) : (
            <div key={i} className="pointer-events-none absolute right-0 left-0 h-px bg-pink-500" style={{ top: g.pos * scale }} />
          ),
        )}

        {/* marquee */}
        {props.marquee && (
          <div
            className="pointer-events-none absolute border border-accent bg-accent/10"
            style={{
              left: props.marquee.x * scale,
              top: props.marquee.y * scale,
              width: props.marquee.w * scale,
              height: props.marquee.h * scale,
            }}
          />
        )}
      </div>

      {/* page footer chrome */}
      <div className="absolute -bottom-6 left-0 flex items-center gap-2 text-[11px] text-ink-3">
        <span>Page {props.index + 1}</span>
        {props.canRemove && (
          <button className="hover:text-danger" onClick={(e) => { e.stopPropagation(); props.onRemove() }}>
            remove
          </button>
        )}
      </div>
    </div>
  )
}

const HANDLE_CURSOR: Record<string, string> = {
  nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
  n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
}

const HANDLE_POS: Record<string, { left?: string; right?: string; top?: string; bottom?: string; transform?: string }> = {
  nw: { left: '0', top: '0' },
  n: { left: '50%', top: '0', transform: 'translateX(-50%)' },
  ne: { right: '0', top: '0' },
  e: { right: '0', top: '50%', transform: 'translateY(-50%)' },
  se: { right: '0', bottom: '0' },
  s: { left: '50%', bottom: '0', transform: 'translateX(-50%)' },
  sw: { left: '0', bottom: '0' },
  w: { left: '0', top: '50%', transform: 'translateY(-50%)' },
}

function Handle(props: { pos: string; onPointerDown: (e: ReactPointerEvent) => void }) {
  return (
    <div
      className="absolute h-2.5 w-2.5 rounded-[3px] border border-accent bg-white shadow-sm"
      style={{ ...HANDLE_POS[props.pos], cursor: HANDLE_CURSOR[props.pos], margin: -5 }}
      onPointerDown={props.onPointerDown}
    />
  )
}

function InlineTextEditor(props: { el: VisualElement; scale: number; onDone: () => void }) {
  const updateProps = useVisualEditorStore((s) => s.updateProps)
  const save = useVisualEditorStore((s) => s.save)
  const [value, setValue] = useState(String(props.el.props?.text ?? ''))
  return (
    <textarea
      autoFocus
      value={value}
      onChange={(e) => {
        setValue(e.target.value)
        updateProps(props.el.id, { text: e.target.value }, `text:${props.el.id}`)
      }}
      onBlur={() => { save(); props.onDone() }}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === 'Escape') props.onDone(); e.stopPropagation() }}
      className="h-full w-full resize-none bg-white/70 outline-none"
      style={{ fontSize: 'inherit', fontFamily: 'inherit' }}
    />
  )
}
