import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { Eye, FileDown, Grid3X3, Magnet, Printer, Redo2, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { defaultFor } from '../editors/visual/elementDefaults'
import { Canvas } from '../editors/visual/Canvas'
import { EditorShell } from '../ui/EditorShell'
import { resolvePath } from '../core/binding/paths'
import { DataContextBar } from '../editors/visual/DataContextBar'
import { Inspector } from '../editors/visual/Inspector'
import { MM_TO_PX } from '../editors/visual/ElementContent'
import { Palette } from '../editors/visual/Palette'
import { PreviewModal } from '../editors/visual/PreviewModal'
import { exportVisualPdf } from '../export/pdf/visualPdf'
import { resolveVisualDocument } from '../core/render/resolve'
import type { ElementType } from '../core/schema/template'
import { useTemplateStore } from '../store/templateStore'
import { useVisualEditorStore } from '../store/visualEditorStore'
import { Button, IconButton } from '../ui/controls'

export function VisualEditorPage() {
  const { id } = useParams<{ id: string }>()
  const repo = useTemplateStore((s) => s.repo)
  const store = useVisualEditorStore()
  const { scenarioId, recordId, setContext } = store
  const [missing, setMissing] = useState(false)
  const [preview, setPreview] = useState(false)
  const [dragLabel, setDragLabel] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  useEffect(() => {
    let cancelled = false
    void repo.get(id ?? '').then((t) => {
      if (cancelled) return
      if (t && t.kind === 'visual') store.load(t)
      else setMissing(true)
    })
    return () => {
      cancelled = true
      store.unload()
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Flush pending autosave when leaving/reloading.
  useEffect(() => {
    const flush = () => store.save()
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onDragStart = (e: DragStartEvent) => {
    const raw = String(e.active.id)
    setDragLabel(raw.startsWith('palette:') ? raw.slice(8) : raw.slice(5))
  }

  const onDragEnd = (e: DragEndEvent) => {
    setDragLabel(null)
    const over = e.over?.id
    if (typeof over !== 'string' || !over.startsWith('page-')) return
    const pageIdx = Number(over.slice(5))
    const pageEl = document.querySelector(`[data-page-index="${pageIdx}"]`)
    if (!(pageEl instanceof HTMLElement)) return

    const act = e.activatorEvent as PointerEvent
    const clientX = act.clientX + e.delta.x
    const clientY = act.clientY + e.delta.y
    const r = pageEl.getBoundingClientRect()
    const scale = MM_TO_PX * useVisualEditorStore.getState().zoom
    const margins = resolveVisualDocument(useVisualEditorStore.getState().template!, useVisualEditorStore.getState().context).margins
    const x = Math.max(0, (clientX - r.left) / scale - margins.left)
    const y = Math.max(0, (clientY - r.top) / scale - margins.top)

    useVisualEditorStore.getState().setPageIndex(pageIdx)

    const raw = String(e.active.id)
    if (raw.startsWith('palette:')) {
      const type = raw.slice(8) as ElementType
      const d = defaultFor(type)
      store.addElement({
        type,
        x,
        y,
        w: d.w,
        h: d.h,
        rotation: 0,
        z: 0,
        props: d.props,
        textStyle: d.textStyle,
        boxStyle: d.boxStyle,
      })
    } else if (raw.startsWith('bind:')) {
      const path = raw.slice(5)
      const isCollection = path.endsWith('[]')
      if (isCollection) {
        // Collection → table element: one column per scalar field of the first item.
        const collPath = path.slice(0, -2)
        const items = resolvePath(useVisualEditorStore.getState().context, collPath)
        const first = Array.isArray(items) ? (items[0] as Record<string, unknown> | undefined) : undefined
        const fields = first
          ? Object.entries(first)
              .filter(([, v]) => typeof v !== 'object' || v === null)
              .map(([k]) => k)
              .slice(0, 6)
          : []
        const colW = Math.max(20, Math.floor(150 / Math.max(fields.length, 1)))
        const d = defaultFor('table')
        store.addElement({
          type: 'table',
          x,
          y,
          w: d.w,
          h: d.h,
          rotation: 0,
          z: 0,
          props: {
            ...d.props,
            rows: { path: collPath },
            columns: fields.map((f, i) => ({
              id: `c${i}`,
              header: f.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
              widthMm: colW,
              align: 'left' as const,
              binding: { path: f },
            })),
          },
          textStyle: d.textStyle,
          boxStyle: d.boxStyle,
        })
      } else {
        store.addElement({
          type: 'text',
          x,
          y,
          w: 60,
          h: 8,
          rotation: 0,
          z: 0,
          props: {},
          binding: { path },
          textStyle: { fontSize: 11 },
        })
      }
    }
  }

  const resolved = useMemo(
    () => (store.template ? resolveVisualDocument(store.template, store.context) : null),
    [store.template, store.context],
  )

  if (missing) {
    return <div className="flex h-full items-center justify-center text-sm text-ink-3">Template not found.</div>
  }
  if (!store.template) {
    return <div className="flex h-full items-center justify-center text-sm text-ink-3">Loading…</div>
  }

  return (
    <EditorShellWrap>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex h-full flex-col">
          <div className="no-print flex h-9 shrink-0 items-center gap-1 border-b border-line bg-panel px-2">
            <IconButton label="Undo" onClick={store.undo} disabled={!store.history.past.length}>
              <Undo2 size={15} />
            </IconButton>
            <IconButton label="Redo" onClick={store.redo} disabled={!store.history.future.length}>
              <Redo2 size={15} />
            </IconButton>
            <div className="mx-1 h-5 w-px bg-line-2" />
            <IconButton label="Grid" active={store.showGrid} onClick={store.toggleGrid}>
              <Grid3X3 size={15} />
            </IconButton>
            <IconButton label="Snap" active={store.snap} onClick={store.toggleSnap}>
              <Magnet size={15} />
            </IconButton>
            <div className="mx-1 h-5 w-px bg-line-2" />
            <IconButton label="Zoom out" onClick={() => store.setZoom(store.zoom - 0.1)}>
              <ZoomOut size={15} />
            </IconButton>
            <span className="w-10 text-center text-xs text-ink-3">{Math.round(store.zoom * 100)}%</span>
            <IconButton label="Zoom in" onClick={() => store.setZoom(store.zoom + 0.1)}>
              <ZoomIn size={15} />
            </IconButton>
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={() => setPreview(true)}>
              <Eye size={13} /> Preview
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => resolved && void exportVisualPdf(resolved, store.template!.name)}
            >
              <FileDown size={13} /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer size={13} /> Print
            </Button>
          </div>
          <DataContextBar scenarioId={scenarioId} recordId={recordId} setContext={setContext} />
          <div className="flex min-h-0 flex-1">
            <Palette />
            <div className="min-w-0 flex-1">
              <Canvas />
            </div>
            <Inspector />
          </div>
        </div>
        <DragOverlay>
          {dragLabel ? (
            <div className="rounded-md border border-accent bg-panel px-2 py-1 text-xs shadow-lg">{dragLabel}</div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {preview && resolved && <PreviewModal resolved={resolved} onClose={() => setPreview(false)} />}
    </EditorShellWrap>
  )
}

function EditorShellWrap({ children }: { children: React.ReactNode }) {
  const template = useVisualEditorStore((s) => s.template)
  const dirty = useVisualEditorStore((s) => s.dirty)
  if (!template) return null
  return (
    <EditorShell template={template} dirty={dirty}>
      {children}
    </EditorShell>
  )
}
