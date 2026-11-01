import { ArrowLeft, Check } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TemplateDoc } from '../core/schema/template'
import { useTemplateStore } from '../store/templateStore'
import { Badge, IconButton } from './controls'

export function EditorShell(props: {
  template: TemplateDoc
  dirty?: boolean
  actions?: ReactNode
  children: ReactNode
}) {
  const nav = useNavigate()
  const { rename, saveState } = useTemplateStore()
  const [name, setName] = useState(props.template.name)
  const [editingName, setEditingName] = useState(false)

  useEffect(() => setName(props.template.name), [props.template.name])

  const status =
    props.dirty || saveState === 'saving'
      ? 'Saving…'
      : saveState === 'error'
        ? 'Save failed'
        : 'Saved'

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="no-print flex h-12 shrink-0 items-center gap-3 border-b border-line bg-panel px-3">
        <IconButton label="Back to templates" onClick={() => nav('/')}>
          <ArrowLeft size={16} />
        </IconButton>
        <div className="h-5 w-px bg-line-2" />
        {editingName ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              rename(props.template.id, name.trim() || props.template.name)
              setEditingName(false)
            }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => e.key === 'Escape' && setEditingName(false)}
              className="h-7 rounded-md border border-accent px-2 text-[13px] font-semibold outline-none"
            />
          </form>
        ) : (
          <button
            className="rounded px-1 py-0.5 text-[13px] font-semibold text-ink hover:bg-black/5"
            onClick={() => setEditingName(true)}
            title="Rename"
          >
            {props.template.name}
          </button>
        )}
        <Badge>{props.template.category}</Badge>
        <span className="flex items-center gap-1 text-[11px] text-ink-3">
          {status === 'Saved' && <Check size={12} className="text-accent" />}
          {status}
        </span>
        <div className="flex-1" />
        {props.actions}
      </header>
      <div className="min-h-0 flex-1">{props.children}</div>
    </div>
  )
}
