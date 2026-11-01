import { useMemo, useState, type ReactNode } from 'react'
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Merge, Undo2, Redo2, FileSpreadsheet, FileDown, Table2,
  Grid3x3, Download,
} from 'lucide-react'
import { useSheetEditorStore } from '../../store/sheetEditorStore'
import { listPaths } from '../../core/binding/paths'
import { a1, colName } from '../../core/sheet/model'
import { Button, IconButton, Select, Field, Input } from '../../ui/controls'
import { Modal } from '../../ui/Modal'
import { clsx } from '../../utils/clsx'

const ORIGIN_LEGEND = [
  ['Source', 'bg-emerald-100 border-emerald-300'],
  ['Formula', 'bg-violet-100 border-violet-300'],
  ['Manual', 'bg-white border-line'],
  ['Overridden', 'bg-amber-100 border-amber-300'],
]

export function SheetToolbar({ onExportXlsx, onExportPdf }: { onExportXlsx: () => void; onExportPdf: () => void }) {
  const s = useSheetEditorStore()
  const sheet = s.template?.sheet
  const [bindingOpen, setBindingOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)

  const cell = sheet?.cells[a1(s.activeCell.row, s.activeCell.col)]
  const st = cell?.style

  const collections = useMemo(() => {
    if (!s.context) return []
    return listPaths(s.context).filter((p) => p.endsWith('[]'))
  }, [s.context])

  const itemFields = useMemo(() => {
    const cp = sheet?.rowSource?.collectionPath
    if (!cp || !s.context) return []
    return listPaths(s.context).filter((p) => p.startsWith(`${cp}.`)).map((p) => p.slice(cp.length + 1))
  }, [sheet?.rowSource?.collectionPath, s.context])

  if (!sheet) return null

  const styleBtn = (
    active: boolean,
    icon: ReactNode,
    fn: () => void,
    label: string,
  ) => (
    <IconButton
      label={label}
      onClick={fn}
      active={active}
    >
      {icon}
    </IconButton>
  )

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-line bg-white px-2 py-1.5">
      <IconButton label="Undo (Ctrl+Z)" onClick={s.undo} disabled={!s.history.past.length}><Undo2 size={15} /></IconButton>
      <IconButton label="Redo (Ctrl+Y)" onClick={s.redo} disabled={!s.history.future.length}><Redo2 size={15} /></IconButton>
      <div className="mx-1 h-5 w-px bg-line" />

      <div className="flex min-w-28 items-center rounded border border-line bg-chrome px-1.5 py-0.5 font-mono text-[11.5px]">
        {s.selAnchor
          ? `${a1(Math.min(s.selAnchor.row, s.activeCell.row), Math.min(s.selAnchor.col, s.activeCell.col))}:${a1(Math.max(s.selAnchor.row, s.activeCell.row), Math.max(s.selAnchor.col, s.activeCell.col))}`
          : a1(s.activeCell.row, s.activeCell.col)}
      </div>
      <div className="mx-1 h-5 w-px bg-line" />

      {styleBtn(!!st?.bold, <Bold size={14} />, () => s.applyStyle({ bold: !st?.bold }), 'Bold')}
      {styleBtn(!!st?.italic, <Italic size={14} />, () => s.applyStyle({ italic: !st?.italic }), 'Italic')}
      {styleBtn(!!st?.underline, <Underline size={14} />, () => s.applyStyle({ underline: !st?.underline }), 'Underline')}
      <div className="mx-1 h-5 w-px bg-line" />
      {styleBtn(st?.align === 'left' || !st?.align, <AlignLeft size={14} />, () => s.applyStyle({ align: 'left' }), 'Align left')}
      {styleBtn(st?.align === 'center', <AlignCenter size={14} />, () => s.applyStyle({ align: 'center' }), 'Align center')}
      {styleBtn(st?.align === 'right', <AlignRight size={14} />, () => s.applyStyle({ align: 'right' }), 'Align right')}
      <div className="mx-1 h-5 w-px bg-line" />

      <Select
        value={String(st?.fontSize ?? 11)}
        onChange={(e) => s.applyStyle({ fontSize: Number(e.target.value) })}
        className="w-16 px-1 py-0.5 text-xs"
        title="Font size"
      >
        {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24].map((n) => <option key={n} value={n}>{n}</option>)}
      </Select>
      <input
        type="color"
        className="h-6 w-7 cursor-pointer rounded border border-line"
        title="Text color"
        value={st?.color ?? '#111827'}
        onChange={(e) => s.applyStyle({ color: e.target.value })}
      />
      <input
        type="color"
        className="h-6 w-7 cursor-pointer rounded border border-line"
        title="Fill"
        value={st?.background ?? '#ffffff'}
        onChange={(e) => s.applyStyle({ background: e.target.value === '#ffffff' ? undefined : e.target.value })}
      />
      <Select
        value={st?.format ?? ''}
        onChange={(e) => s.applyStyle({ format: (e.target.value || undefined) as never })}
        className="w-24 px-1 py-0.5 text-xs"
        title="Number format"
      >
        <option value="">General</option>
        <option value="number">Number</option>
        <option value="currency">Currency</option>
        <option value="date">Date</option>
      </Select>
      <IconButton label="Merge selection" onClick={s.mergeRange}><Merge size={14} /></IconButton>
      <IconButton label="Unmerge" onClick={() => s.unmergeAt(s.activeCell.row, s.activeCell.col)}><Grid3x3 size={14} /></IconButton>

      <div className="mx-1 h-5 w-px bg-line" />
      <Select
        value=""
        onChange={(e) => {
          const [what, dir] = e.target.value.split(':')
          const { row, col } = s.activeCell
          if (what === 'ins-row') s.insertRow(dir === 'above' ? row : row + 1)
          if (what === 'del-row') s.deleteRow(row)
          if (what === 'ins-col') s.insertCol(dir === 'left' ? col : col + 1)
          if (what === 'del-col') s.deleteCol(col)
        }}
        className="px-1 py-0.5 text-xs"
        title="Row/column operations"
      >
        <option value="">Rows / Cols…</option>
        <option value="ins-row:above">Insert row above</option>
        <option value="ins-row:below">Insert row below</option>
        <option value="del-row:">Delete row</option>
        <option value="ins-col:left">Insert column left</option>
        <option value="ins-col:right">Insert column right</option>
        <option value="del-col:">Delete column</option>
      </Select>

      <div className="flex-1" />
      <div className="mr-2 hidden items-center gap-1.5 lg:flex" title="Cell origins">
        {ORIGIN_LEGEND.map(([label, cls]) => (
          <span key={label} className={clsx('rounded border px-1.5 py-0.5 text-[10px]', cls)}>{label}</span>
        ))}
      </div>
      <Button variant="ghost" onClick={() => setBindingOpen(true)} title="Bind rows to a data collection">
        <Table2 size={14} /> Data
      </Button>
      <Button variant="ghost" onClick={() => setPrintOpen(true)} title="Print settings">
        <FileDown size={14} /> Print
      </Button>
      <Button variant="outline" onClick={onExportXlsx} title="Export XLSX">
        <FileSpreadsheet size={14} /> XLSX
      </Button>
      <Button variant="primary" onClick={onExportPdf} title="Export PDF">
        <Download size={14} /> PDF
      </Button>

      <Modal open={bindingOpen} onClose={() => setBindingOpen(false)} title="Dynamic row binding">
        <div className="space-y-3">
          <Field label="Data provider">
            <Select
              value={sheet.rowSource?.source ?? ''}
              onChange={(e) => s.setRowSource(e.target.value ? { ...sheet.rowSource!, source: e.target.value } : null)}
            >
              <option value="">None</option>
              <option value="demo">DemoProvider</option>
            </Select>
          </Field>
          <Field label="Collection path (records repeat per row)">
            <Select
              value={sheet.rowSource?.collectionPath ?? ''}
              onChange={(e) =>
                s.setRowSource({
                  source: sheet.rowSource?.source ?? 'demo',
                  collectionPath: e.target.value,
                  startRow: sheet.rowSource?.startRow ?? 2,
                  mapping: sheet.rowSource?.mapping ?? {},
                })
              }
            >
              <option value="">Choose…</option>
              {collections.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
          {sheet.rowSource?.collectionPath && (
            <>
              <Field label="Start row">
                <Input
                  type="number" min={1}
                  value={sheet.rowSource.startRow}
                  onChange={(e) => s.setRowSource({ ...sheet.rowSource!, startRow: Math.max(1, Number(e.target.value) || 1) })}
                />
              </Field>
              <div>
                <div className="mb-1 text-xs font-medium text-ink">Column mapping</div>
                <div className="max-h-52 space-y-1.5 overflow-auto">
                  {Array.from({ length: Math.min(sheet.colCount, 12) }, (_, i) => i + 1).map((col) => (
                    <div key={col} className="flex items-center gap-2">
                      <span className="w-6 text-center font-mono text-xs text-ink-soft">{colName(col)}</span>
                      <Select
                        value={sheet.rowSource!.mapping[colName(col)] ?? ''}
                        onChange={(e) => {
                          const mapping = { ...sheet.rowSource!.mapping }
                          if (e.target.value) mapping[colName(col)] = e.target.value
                          else delete mapping[colName(col)]
                          s.setRowSource({ ...sheet.rowSource!, mapping })
                        }}
                      >
                        <option value="">—</option>
                        {itemFields.map((p) => <option key={p} value={p}>{p}</option>)}
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => { s.applyRowSource(); }} disabled={!s.context}>
                  Apply to sheet
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal open={printOpen} onClose={() => setPrintOpen(false)} title="Print settings">
        <div className="space-y-3">
          <Field label="Orientation">
            <Select value={sheet.print.orientation} onChange={(e) => s.setPrint({ orientation: e.target.value as 'portrait' | 'landscape' })}>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </Select>
          </Field>
          <Field label="Paper size">
            <Select value={sheet.print.size} onChange={(e) => s.setPrint({ size: e.target.value as 'A4' | 'A3' | 'custom' })}>
              <option value="A4">A4</option>
              <option value="A3">A3</option>
              <option value="custom">Custom</option>
            </Select>
          </Field>
          <Field label="Print area (A1 range, empty = used range)">
            <Input
              value={sheet.print.area ?? ''}
              placeholder="A1:H40"
              onChange={(e) => s.setPrint({ area: e.target.value.trim() || null })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Frozen rows">
              <Input type="number" min={0} max={10} value={sheet.frozenRows} onChange={(e) => s.mutate((sh) => { sh.frozenRows = Math.max(0, Number(e.target.value) || 0) })} />
            </Field>
            <Field label="Frozen cols">
              <Input type="number" min={0} max={10} value={sheet.frozenCols} onChange={(e) => s.mutate((sh) => { sh.frozenCols = Math.max(0, Number(e.target.value) || 0) })} />
            </Field>
            <Field label="Repeat header rows">
              <Input type="number" min={0} max={10} value={sheet.print.repeatHeaderRows} onChange={(e) => s.setPrint({ repeatHeaderRows: Math.max(0, Number(e.target.value) || 0) })} />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  )
}
