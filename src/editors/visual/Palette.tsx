import { useDraggable } from '@dnd-kit/core'
import {
  Barcode,
  Baseline,
  FileDigit,
  Image,
  Minus,
  PenLine,
  RectangleHorizontal,
  Slash,
  Table,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { listPaths } from '../../core/binding/paths'
import { getProvider } from '../../core/providers/registry'
import type { ElementType } from '../../core/schema/template'
import { useVisualEditorStore } from '../../store/visualEditorStore'

const BASIC: { type: ElementType; label: string; icon: ReactNode }[] = [
  { type: 'text', label: 'Text', icon: <Baseline size={15} /> },
  { type: 'richText', label: 'Rich text', icon: <PenLine size={15} /> },
  { type: 'image', label: 'Image', icon: <Image size={15} /> },
  { type: 'rect', label: 'Rectangle', icon: <RectangleHorizontal size={15} /> },
  { type: 'line', label: 'Line', icon: <Slash size={15} /> },
  { type: 'divider', label: 'Divider', icon: <Minus size={15} /> },
  { type: 'table', label: 'Table', icon: <Table size={15} /> },
  { type: 'qr', label: 'QR code', icon: <Barcode size={15} /> },
  { type: 'pageNumber', label: 'Page number', icon: <FileDigit size={15} /> },
]

function DraggableItem(props: { id: string; label: string; icon: ReactNode; hint?: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-ink-2 hover:bg-black/5 active:cursor-grabbing ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <span className="text-ink-3">{props.icon}</span>
      <span className="truncate">{props.label}</span>
      {props.hint && <span className="ml-auto truncate text-[10px] text-ink-3/70">{props.hint}</span>}
    </div>
  )
}

export function Palette() {
  const { scenarioId, context } = useVisualEditorStore()
  const [contextPaths, setContextPaths] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const scenario = scenarioId ?? 'student-profile'
      const sample = Object.keys(context).length
        ? context
        : await getProvider().sampleContext(scenario)
      if (!cancelled) setContextPaths(listPaths(sample))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [scenarioId, context])

  const groups = useMemo(() => {
    const top = new Map<string, string[]>()
    for (const p of contextPaths) {
      const root = p.split('.')[0] ?? p
      const list = top.get(root) ?? []
      if (list.length < 40) list.push(p)
      top.set(root, list)
    }
    return [...top.entries()]
  }, [contextPaths])

  return (
    <aside className="no-print flex w-56 shrink-0 flex-col overflow-hidden border-r border-line bg-panel">
      <div className="border-b border-line px-3 py-2.5">
        <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Components</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-1 px-1 text-[10.5px] font-semibold text-ink-3/80">Basic</div>
        {BASIC.map((b) => (
          <DraggableItem key={b.type} id={`palette:${b.type}`} label={b.label} icon={b.icon} />
        ))}

        <div className="mt-3 mb-1 px-1 text-[10.5px] font-semibold text-ink-3/80">
          Data fields{!scenarioId ? ' (sample)' : ''}
        </div>
        {groups.length === 0 && (
          <p className="px-2 text-[11px] text-ink-3">Pick a data context to see fields.</p>
        )}
        {groups.map(([root, paths]) => (
          <details key={root} className="group mb-1" open={groups.length <= 3}>
            <summary className="cursor-pointer rounded-md px-2 py-1 text-[12px] font-medium text-ink-2 select-none hover:bg-black/5">
              {root}
            </summary>
            <div className="ml-2">
              {paths.map((p) => (
                <DraggableItem
                  key={p}
                  id={`bind:${p}`}
                  label={p.replace(/\[\]/g, '[ ]')}
                  icon={<span className="font-mono text-[10px] text-accent">{}</span>}
                />
              ))}
            </div>
          </details>
        ))}
      </div>
      <div className="border-t border-line p-2 text-[10.5px] leading-snug text-ink-3">
        Drag onto a page — or click to insert at the centre.
      </div>
    </aside>
  )
}
