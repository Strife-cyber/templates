import {
  Copy,
  Download,
  FilePlus2,
  FileText,
  FileUp,
  LayoutTemplate,
  MoreHorizontal,
  Sheet,
  SquarePen,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { exportTemplateJson } from '../persistence/templateRepository'
import type { TemplateCategory, TemplateDoc, TemplateKind } from '../core/schema/template'
import { useTemplateStore } from '../store/templateStore'
import { Badge, Button, EmptyState, Field, Input, Select } from '../ui/controls'
import { Modal } from '../ui/Modal'

const CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: 'academic', label: 'Academic' },
  { value: 'financial', label: 'Financial' },
  { value: 'administrative', label: 'Administrative' },
  { value: 'general', label: 'General' },
]

const KINDS: { value: TemplateKind; label: string; hint: string }[] = [
  { value: 'visual', label: 'Visual document', hint: 'Freeform designer — receipts, report cards, certificates' },
  { value: 'sheet', label: 'Spreadsheet', hint: 'Grid editor — mark sheets, class PVs, registers' },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function TemplateCard({ t }: { t: TemplateDoc }) {
  const nav = useNavigate()
  const { remove, duplicate, rename } = useTemplateStore()
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(t.name)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  const open = () => nav(`/editor/${t.kind}/${t.id}`)

  const exportJson = () => {
    const blob = new Blob([exportTemplateJson(t)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${t.name.replace(/[^\w-]+/g, '-').toLowerCase()}.template.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="group relative flex flex-col rounded-lg border border-line bg-panel transition-shadow hover:shadow-md">
      <button
        onClick={open}
        className="flex h-28 items-center justify-center rounded-t-lg border-b border-line bg-gradient-to-br from-chrome to-black/4 text-ink-3"
      >
        {t.kind === 'visual' ? <SquarePen size={30} /> : <Sheet size={30} />}
      </button>
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                rename(t.id, name.trim() || t.name)
                setRenaming(false)
              }}
            >
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setRenaming(false)}
                onKeyDown={(e) => e.key === 'Escape' && setRenaming(false)}
              />
            </form>
          ) : (
            <button onClick={open} className="block w-full truncate text-left text-[13px] font-semibold text-ink hover:text-accent-2">
              {t.name}
            </button>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone="accent">{t.kind === 'visual' ? 'Visual' : 'Spreadsheet'}</Badge>
            <Badge>{t.category}</Badge>
            <span className="text-[11px] text-ink-3">edited {formatDate(t.updatedAt)}</span>
          </div>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            aria-label="Template actions"
            onClick={() => setMenu((m) => !m)}
            className="rounded-md p-1 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/5"
          >
            <MoreHorizontal size={16} />
          </button>
          {menu && (
            <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-panel py-1 shadow-lg">
              <MenuItem icon={<SquarePen size={14} />} label="Rename" onClick={() => { setRenaming(true); setMenu(false) }} />
              <MenuItem icon={<Copy size={14} />} label="Duplicate" onClick={() => { duplicate(t.id); setMenu(false) }} />
              <MenuItem icon={<Download size={14} />} label="Export JSON" onClick={() => { exportJson(); setMenu(false) }} />
              <div className="my-1 border-t border-line" />
              <MenuItem icon={<Trash2 size={14} />} label="Delete" danger onClick={() => { remove(t.id); setMenu(false) }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MenuItem(props: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={props.onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-black/4 ${
        props.danger ? 'text-danger' : 'text-ink-2'
      }`}
    >
      {props.icon}
      {props.label}
    </button>
  )
}

export function HomePage() {
  const { templates, loaded, refresh, create, importJson } = useTemplateStore()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<TemplateCategory>('academic')
  const [kind, setKind] = useState<TemplateKind>('visual')
  const [importError, setImportError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const nav = useNavigate()

  useEffect(() => {
    if (!loaded) void refresh()
  }, [loaded, refresh])

  const visible = templates.filter(
    (t) => !filter || t.name.toLowerCase().includes(filter.toLowerCase()),
  )
  const recent = visible.slice(0, 4)

  const submit = async () => {
    if (!name.trim()) return
    const t = await create({ name: name.trim(), category, kind })
    setCreating(false)
    setName('')
    nav(`/editor/${t.kind}/${t.id}`)
  }

  const onImportFile = async (file: File) => {
    const text = await file.text()
    const result = await importJson(text)
    if (result.ok) nav(`/editor/${result.template.kind}/${result.template.id}`)
    else setImportError(result.error)
  }

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white">
            <LayoutTemplate size={18} />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">Document Studio</h1>
            <p className="text-xs text-ink-3">Design reusable document templates bound to live data</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <FileUp size={15} /> Import template
          </Button>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <FilePlus2 size={15} /> New template
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImportFile(f)
              e.target.value = ''
            }}
          />
        </div>
      </header>

      {importError && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-danger">
          <span>Import failed — {importError}</span>
          <Button size="sm" onClick={() => setImportError(null)}>Dismiss</Button>
        </div>
      )}

      {templates.length === 0 && loaded ? (
        <div className="rounded-xl border border-dashed border-line-2 bg-panel">
          <EmptyState
            icon={<FileText size={36} />}
            title="No templates yet"
            body="Create a visual document template for receipts and report cards, or a spreadsheet template for mark sheets and class PVs."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                <FilePlus2 size={15} /> Create your first template
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-2">Recent</h2>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {recent.map((t) => <TemplateCard key={t.id} t={t} />)}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-2">Template library</h2>
              <Input
                placeholder="Filter by name…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-56"
              />
            </div>
            <div className="grid grid-cols-4 gap-4">
              {visible.map((t) => <TemplateCard key={t.id} t={t} />)}
            </div>
            {visible.length === 0 && (
              <p className="py-8 text-center text-xs text-ink-3">No templates match “{filter}”.</p>
            )}
          </section>
        </>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New template">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <Field label="Template name">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Term 1 report card" />
          </Field>
          <Field label="Document category">
            <Select value={category} onChange={(e) => setCategory(e.target.value as TemplateCategory)} className="w-full">
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Editor type">
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    kind === k.value ? 'border-accent bg-accent-soft' : 'border-line-2 hover:border-ink-3/40'
                  }`}
                >
                  <div className="text-[13px] font-semibold text-ink">{k.label}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-ink-3">{k.hint}</div>
                </button>
              ))}
            </div>
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" onClick={() => setCreating(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!name.trim()}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
