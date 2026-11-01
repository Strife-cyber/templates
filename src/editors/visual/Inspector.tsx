import { Copy, Eye, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { listPaths } from '../../core/binding/paths'
import { getProvider } from '../../core/providers/registry'
import type {
  Binding,
  Condition,
  FormatSpec,
  TableColumn,
  TableProps,
  VisualElement,
} from '../../core/schema/template'
import { useVisualEditorStore } from '../../store/visualEditorStore'
import { Button, Field, Input, Select } from '../../ui/controls'

const FONTS = ['Inter', 'Georgia', 'Times New Roman', 'Courier New', 'Arial', 'Verdana']

function NumberInput(props: {
  value: number
  onChange: (n: number) => void
  step?: number
  min?: number
}) {
  const [text, setText] = useState(String(props.value))
  useEffect(() => setText(String(Math.round(props.value * 100) / 100)), [props.value])
  return (
    <input
      type="number"
      value={text}
      step={props.step ?? 1}
      min={props.min}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value)
        if (Number.isFinite(n)) props.onChange(n)
      }}
      className="h-7 w-full rounded-md border border-line-2 bg-panel px-1.5 text-xs outline-none focus:border-accent"
    />
  )
}

function ColorInput(props: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(props.value) ? props.value : '#ffffff'}
        onChange={(e) => props.onChange(e.target.value)}
        className="h-7 w-8 cursor-pointer rounded border border-line-2"
      />
      <Input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="h-7 text-xs"
        placeholder="#hex or transparent"
      />
    </div>
  )
}

function BindingPicker(props: { binding?: Binding; onChange: (b: Binding | undefined) => void }) {
  const { context, scenarioId } = useVisualEditorStore()
  const [paths, setPaths] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const sample = Object.keys(context).length
        ? context
        : await getProvider().sampleContext(scenarioId ?? 'student-profile')
      if (!cancelled) setPaths(listPaths(sample).filter((p) => !p.endsWith('[]')))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [context, scenarioId])

  const b = props.binding
  const set = (patch: Partial<Binding>) =>
    props.onChange({ ...(b ?? { path: '' }), ...patch })

  const setFormat = (type: string) => {
    if (type === 'none') set({ format: undefined })
    else {
      const base = { type } as FormatSpec
      set({ format: base })
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <Select
          value={b?.path ?? ''}
          onChange={(e) => (e.target.value ? set({ path: e.target.value }) : props.onChange(undefined))}
          className="h-7 flex-1 text-xs"
        >
          <option value="">No binding</option>
          {paths.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>
      {b?.path && (
        <>
          <Input
            value={b.path}
            onChange={(e) => set({ path: e.target.value })}
            className="h-7 font-mono text-[11px]"
            placeholder="custom.path"
          />
          <div className="flex gap-1.5">
            <Select
              value={b.format?.type ?? 'none'}
              onChange={(e) => setFormat(e.target.value)}
              className="h-7 flex-1 text-xs"
            >
              <option value="none">Raw value</option>
              <option value="date">Date</option>
              <option value="currency">Currency</option>
              <option value="number">Number</option>
              <option value="upper">UPPERCASE</option>
              <option value="lower">lowercase</option>
              <option value="title">Title Case</option>
            </Select>
            <Input
              value={b.fallback ?? ''}
              onChange={(e) => set({ fallback: e.target.value || undefined })}
              placeholder="Fallback"
              className="h-7 flex-1 text-xs"
            />
          </div>
          {b.format?.type === 'date' && (
            <Input
              value={b.format.pattern}
              onChange={(e) => set({ format: { type: 'date', pattern: e.target.value } })}
              className="h-7 font-mono text-[11px]"
              placeholder="DD/MM/YYYY"
            />
          )}
          {b.format?.type === 'currency' && (
            <Input
              value={b.format.currency}
              onChange={(e) => set({ format: { type: 'currency', currency: e.target.value } })}
              className="h-7 font-mono text-[11px]"
              placeholder="XAF"
            />
          )}
          {b.format?.type === 'number' && (
            <NumberInput
              value={b.format.decimals}
              onChange={(n) => set({ format: { type: 'number', decimals: n } })}
              min={0}
            />
          )}
        </>
      )}
    </div>
  )
}

function ConditionEditor(props: { cond?: Condition; onChange: (c: Condition | undefined) => void }) {
  const c = props.cond
  if (!c) {
    return (
      <Button size="sm" variant="outline" onClick={() => props.onChange({ path: '', op: 'exists' })}>
        <Plus size={12} /> Add visibility rule
      </Button>
    )
  }
  return (
    <div className="space-y-1.5 rounded-md border border-line p-2">
      <div className="flex gap-1.5">
        <Input
          value={c.path}
          onChange={(e) => props.onChange({ ...c, path: e.target.value })}
          placeholder="path.to.field"
          className="h-7 flex-1 font-mono text-[11px]"
        />
        <Button size="sm" variant="danger" onClick={() => props.onChange(undefined)}>
          <Trash2 size={12} />
        </Button>
      </div>
      <div className="flex gap-1.5">
        <Select
          value={c.op}
          onChange={(e) => props.onChange({ ...c, op: e.target.value as Condition['op'] })}
          className="h-7 text-xs"
        >
          <option value="exists">is set</option>
          <option value="empty">is empty</option>
          <option value="eq">=</option>
          <option value="neq">≠</option>
          <option value="gt">&gt;</option>
          <option value="gte">≥</option>
          <option value="lt">&lt;</option>
          <option value="lte">≤</option>
          <option value="contains">contains</option>
        </Select>
        {!['exists', 'empty'].includes(c.op) && (
          <Input
            value={String(c.value ?? '')}
            onChange={(e) => props.onChange({ ...c, value: e.target.value })}
            className="h-7 flex-1 text-xs"
            placeholder="value"
          />
        )}
      </div>
    </div>
  )
}

function TableEditor(props: { el: VisualElement; paths: string[] }) {
  const storeUpdate = useVisualEditorStore((s) => s.updateProps)
  const p = props.el.props as unknown as TableProps
  const columns: TableColumn[] = p.columns ?? []

  const setColumns = (cols: TableColumn[]) => storeUpdate(props.el.id, { columns: cols }, `tablecols:${props.el.id}`)

  return (
    <div className="space-y-2">
      <Field label="Rows collection">
        <Select
          value={p.rows?.path ?? ''}
          onChange={(e) => storeUpdate(props.el.id, { rows: { ...(p.rows ?? {}), path: e.target.value } })}
          className="h-7 w-full text-xs"
        >
          <option value="">Select a collection…</option>
          {props.paths
            .filter((path) => path.endsWith('[]'))
            .map((path) => (
              <option key={path} value={path.replace(/\[\]$/, '')}>
                {path}
              </option>
            ))}
        </Select>
      </Field>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-ink-3">Columns</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setColumns([...columns, { id: `c${Date.now() % 100000}`, header: 'New', widthMm: 30, align: 'left' }])
            }
          >
            <Plus size={12} /> Add
          </Button>
        </div>
        {columns.map((col, i) => {
          const collectionPath = p.rows?.path ?? ''
          const itemPaths = props.paths
            .filter((path) => path.startsWith(`${collectionPath}[].`))
            .map((path) => path.slice(collectionPath.length + 3))
          return (
            <div key={col.id} className="space-y-1 rounded-md border border-line p-1.5">
              <div className="flex items-center gap-1">
                <Input
                  value={col.header}
                  onChange={(e) => {
                    const next = [...columns]
                    next[i] = { ...col, header: e.target.value }
                    setColumns(next)
                  }}
                  className="h-7 flex-1 text-[11px]"
                />
                <NumberInput
                  value={col.widthMm}
                  onChange={(n) => {
                    const next = [...columns]
                    next[i] = { ...col, widthMm: Math.max(5, n) }
                    setColumns(next)
                  }}
                  min={5}
                />
                <Select
                  value={col.align}
                  onChange={(e) => {
                    const next = [...columns]
                    next[i] = { ...col, align: e.target.value as TableColumn['align'] }
                    setColumns(next)
                  }}
                  className="h-7 text-[11px]"
                >
                  <option value="left">L</option>
                  <option value="center">C</option>
                  <option value="right">R</option>
                </Select>
                <button
                  className="text-ink-3 hover:text-danger"
                  onClick={() => setColumns(columns.filter((_, j) => j !== i))}
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <Select
                value={col.binding?.path ?? ''}
                onChange={(e) => {
                  const next = [...columns]
                  next[i] = e.target.value
                    ? { ...col, binding: { path: e.target.value } }
                    : { ...col, binding: undefined }
                  setColumns(next)
                }}
                className="h-7 w-full text-[11px]"
              >
                <option value="">No field</option>
                {itemPaths.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
              </Select>
            </div>
          )
        })}
      </div>

      <div className="flex gap-2">
        <Field label="Row height (mm)">
          <NumberInput value={p.rowHeightMm ?? 8} onChange={(n) => storeUpdate(props.el.id, { rowHeightMm: n })} />
        </Field>
        <Field label="Header height (mm)">
          <NumberInput value={p.headerHeightMm ?? 9} onChange={(n) => storeUpdate(props.el.id, { headerHeightMm: n })} />
        </Field>
      </div>
      <div className="flex gap-3 text-xs text-ink-2">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={p.showHeader !== false}
            onChange={(e) => storeUpdate(props.el.id, { showHeader: e.target.checked })}
          />
          Header row
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={!!p.zebra}
            onChange={(e) => storeUpdate(props.el.id, { zebra: e.target.checked })}
          />
          Zebra rows
        </label>
      </div>
    </div>
  )
}

export function Inspector() {
  const { template, pageIndex, selectedIds, updateElement, updateProps, deleteSelected, duplicateSelected, reorderSelected, scenarioId, context } =
    useVisualEditorStore()
  const [paths, setPaths] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const sample = Object.keys(context).length
        ? context
        : await getProvider().sampleContext(scenarioId ?? 'student-profile')
      if (!cancelled) setPaths(listPaths(sample))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [context, scenarioId])

  const page = template?.pages?.[pageIndex]
  const selected = useMemo(
    () => page?.elements.filter((e) => selectedIds.includes(e.id)) ?? [],
    [page, selectedIds],
  )
  const el = selected.length === 1 ? selected[0] : undefined

  if (!el) {
    return (
      <aside className="no-print flex w-64 shrink-0 flex-col border-l border-line bg-panel">
        <div className="border-b border-line px-3 py-2.5">
          <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Properties</h3>
        </div>
        <div className="p-4 text-xs leading-relaxed text-ink-3">
          {selected.length > 1 ? (
            <>
              <p className="mb-3">{selected.length} elements selected.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={duplicateSelected}>
                  <Copy size={12} /> Duplicate
                </Button>
                <Button size="sm" variant="danger" onClick={deleteSelected}>
                  <Trash2 size={12} /> Delete
                </Button>
              </div>
            </>
          ) : (
            'Select an element to edit its properties. Drag components from the left panel onto the page.'
          )}
        </div>
      </aside>
    )
  }

  const ts = el.textStyle ?? {}
  const bs = el.boxStyle ?? {}
  const setTextStyle = (patch: Record<string, unknown>) => updateElement(el.id, { textStyle: { ...ts, ...patch } }, `style:${el.id}`)
  const setBoxStyle = (patch: Record<string, unknown>) => updateElement(el.id, { boxStyle: { ...bs, ...patch } }, `box:${el.id}`)

  return (
    <aside className="no-print flex w-64 shrink-0 flex-col overflow-hidden border-l border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
          {el.type}
        </h3>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={duplicateSelected} title="Duplicate">
            <Copy size={13} />
          </Button>
          <Button size="sm" variant="danger" onClick={deleteSelected} title="Delete">
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {/* Geometry */}
        <section className="space-y-2">
          <div className="grid grid-cols-4 gap-1.5">
            <Field label="X"><NumberInput value={el.x} onChange={(n) => updateElement(el.id, { x: n }, `geom:${el.id}`)} /></Field>
            <Field label="Y"><NumberInput value={el.y} onChange={(n) => updateElement(el.id, { y: n }, `geom:${el.id}`)} /></Field>
            <Field label="W"><NumberInput value={el.w} onChange={(n) => updateElement(el.id, { w: Math.max(1, n) }, `geom:${el.id}`)} min={1} /></Field>
            <Field label="H"><NumberInput value={el.h} onChange={(n) => updateElement(el.id, { h: Math.max(1, n) }, `geom:${el.id}`)} min={1} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Rotation °">
              <NumberInput value={el.rotation} onChange={(n) => updateElement(el.id, { rotation: n }, `geom:${el.id}`)} />
            </Field>
            <Field label="Opacity">
              <NumberInput value={bs.opacity ?? 1} onChange={(n) => setBoxStyle({ opacity: Math.min(1, Math.max(0, n)) })} step={0.1} min={0} />
            </Field>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => reorderSelected('front')}>To front</Button>
            <Button size="sm" variant="outline" onClick={() => reorderSelected('backward')}>Backward</Button>
            <Button size="sm" variant="outline" onClick={() => reorderSelected('forward')}>Forward</Button>
            <Button size="sm" variant="outline" onClick={() => reorderSelected('back')}>To back</Button>
          </div>
        </section>

        {/* Content */}
        {(el.type === 'text' || el.type === 'qr' || el.type === 'pageNumber') && (
          <section>
            <h4 className="mb-1.5 text-[11px] font-semibold text-ink-3 uppercase">
              {el.type === 'pageNumber' ? 'Format' : 'Content'}
            </h4>
            {el.type === 'text' && (
              <textarea
                value={String(el.props?.text ?? '')}
                onChange={(e) => updateProps(el.id, { text: e.target.value }, `text:${el.id}`)}
                rows={2}
                className="w-full rounded-md border border-line-2 p-1.5 text-xs outline-none focus:border-accent"
              />
            )}
            {el.type === 'qr' && (
              <Input
                value={String(el.props?.value ?? '')}
                onChange={(e) => updateProps(el.id, { value: e.target.value }, `qr:${el.id}`)}
                placeholder="Static value or bind below"
                className="h-7 text-xs"
              />
            )}
            {el.type === 'pageNumber' && (
              <Select
                value={String(el.props?.format ?? 'n/total')}
                onChange={(e) => updateProps(el.id, { format: e.target.value })}
                className="h-7 w-full text-xs"
              >
                <option value="n">1</option>
                <option value="n/total">1 / 3</option>
                <option value="Page {n} of {total}">Page 1 of 3</option>
              </Select>
            )}
          </section>
        )}

        {el.type === 'image' && (
          <section className="space-y-2">
            <h4 className="text-[11px] font-semibold text-ink-3 uppercase">Image</h4>
            <Select
              value={String(el.props?.fit ?? 'contain')}
              onChange={(e) => updateProps(el.id, { fit: e.target.value })}
              className="h-7 w-full text-xs"
            >
              <option value="contain">Fit</option>
              <option value="cover">Fill</option>
              <option value="fill">Stretch</option>
            </Select>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-line-2 p-2 text-xs text-ink-3 hover:border-accent">
              Upload image…
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const reader = new FileReader()
                  reader.onload = () => updateProps(el.id, { src: String(reader.result) })
                  reader.readAsDataURL(f)
                }}
              />
            </label>
          </section>
        )}

        {/* Data binding */}
        {['text', 'image', 'qr', 'richText'].includes(el.type) && (
          <section>
            <h4 className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-ink-3 uppercase">
              <Eye size={11} /> Data binding
            </h4>
            <BindingPicker
              binding={el.binding}
              onChange={(b) => updateElement(el.id, { binding: b }, `bind:${el.id}`)}
            />
          </section>
        )}

        {el.type === 'table' && (
          <section>
            <h4 className="mb-1.5 text-[11px] font-semibold text-ink-3 uppercase">Table</h4>
            <TableEditor el={el} paths={paths} />
          </section>
        )}

        {/* Typography */}
        {['text', 'richText', 'pageNumber', 'table'].includes(el.type) && (
          <section className="space-y-2">
            <h4 className="text-[11px] font-semibold text-ink-3 uppercase">Typography</h4>
            <div className="flex gap-1.5">
              <Select value={ts.fontFamily ?? 'Inter'} onChange={(e) => setTextStyle({ fontFamily: e.target.value })} className="h-7 flex-1 text-xs">
                {FONTS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </Select>
              <div className="w-16">
                <NumberInput value={ts.fontSize ?? 11} onChange={(n) => setTextStyle({ fontSize: Math.max(4, n) })} min={4} />
              </div>
            </div>
            <div className="flex items-center gap-1">
              {(['left', 'center', 'right'] as const).map((a) => (
                <Button
                  key={a}
                  size="sm"
                  variant={ts.align === a ? 'primary' : 'outline'}
                  onClick={() => setTextStyle({ align: a })}
                  className="flex-1 capitalize"
                >
                  {a.slice(0, 1).toUpperCase()}
                </Button>
              ))}
              <Button size="sm" variant={ts.fontWeight === 'bold' ? 'primary' : 'outline'} onClick={() => setTextStyle({ fontWeight: ts.fontWeight === 'bold' ? 'normal' : 'bold' })}>B</Button>
              <Button size="sm" variant={ts.fontStyle === 'italic' ? 'primary' : 'outline'} onClick={() => setTextStyle({ fontStyle: ts.fontStyle === 'italic' ? 'normal' : 'italic' })}><i>I</i></Button>
              <Button size="sm" variant={ts.underline ? 'primary' : 'outline'} onClick={() => setTextStyle({ underline: !ts.underline })}><u>U</u></Button>
            </div>
            <Field label="Text color">
              <ColorInput value={ts.color ?? '#111827'} onChange={(v) => setTextStyle({ color: v })} />
            </Field>
            <Field label="Vertical align">
              <Select value={ts.valign ?? 'top'} onChange={(e) => setTextStyle({ valign: e.target.value })} className="h-7 w-full text-xs">
                <option value="top">Top</option>
                <option value="middle">Middle</option>
                <option value="bottom">Bottom</option>
              </Select>
            </Field>
          </section>
        )}

        {/* Box style */}
        {el.type !== 'line' && el.type !== 'divider' && (
          <section className="space-y-2">
            <h4 className="text-[11px] font-semibold text-ink-3 uppercase">Box</h4>
            <Field label="Background">
              <ColorInput value={bs.background ?? 'transparent'} onChange={(v) => setBoxStyle({ background: v })} />
            </Field>
            <div className="grid grid-cols-3 gap-1.5">
              <Field label="Border">
                <NumberInput value={bs.borderWidth ?? 0} onChange={(n) => setBoxStyle({ borderWidth: Math.max(0, n) })} step={0.1} min={0} />
              </Field>
              <Field label="Radius">
                <NumberInput value={bs.borderRadius ?? 0} onChange={(n) => setBoxStyle({ borderRadius: Math.max(0, n) })} min={0} />
              </Field>
              <Field label="Padding">
                <NumberInput value={bs.padding ?? 0} onChange={(n) => setBoxStyle({ padding: Math.max(0, n) })} min={0} />
              </Field>
            </div>
            {(bs.borderWidth ?? 0) > 0 && (
              <Field label="Border color">
                <ColorInput value={bs.borderColor ?? '#111827'} onChange={(v) => setBoxStyle({ borderColor: v })} />
              </Field>
            )}
          </section>
        )}

        {(el.type === 'line' || el.type === 'divider' || el.type === 'rect' || el.type === 'table') && (
          <section className="space-y-2">
            <h4 className="text-[11px] font-semibold text-ink-3 uppercase">
              {el.type === 'rect' || el.type === 'table' ? 'Border' : 'Stroke'}
            </h4>
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Width (mm)">
                <NumberInput value={bs.borderWidth ?? 0.3} onChange={(n) => setBoxStyle({ borderWidth: Math.max(0, n) })} step={0.1} min={0} />
              </Field>
              <Field label="Style">
                <Select value={bs.borderStyle ?? 'solid'} onChange={(e) => setBoxStyle({ borderStyle: e.target.value })} className="h-7 w-full text-xs">
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </Select>
              </Field>
            </div>
            <Field label="Color">
              <ColorInput value={bs.borderColor ?? '#111827'} onChange={(v) => setBoxStyle({ borderColor: v })} />
            </Field>
          </section>
        )}

        {/* Visibility */}
        <section>
          <h4 className="mb-1.5 text-[11px] font-semibold text-ink-3 uppercase">Visibility</h4>
          <ConditionEditor
            cond={el.visibleWhen}
            onChange={(c) => updateElement(el.id, { visibleWhen: c }, `vis:${el.id}`)}
          />
        </section>
      </div>
    </aside>
  )
}
