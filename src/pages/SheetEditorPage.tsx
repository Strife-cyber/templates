import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSheetEditorStore } from '../store/sheetEditorStore'
import { SheetGrid } from '../editors/sheet/Grid'
import { SheetToolbar } from '../editors/sheet/SheetToolbar'
import { DataContextBar } from '../editors/visual/DataContextBar'
import { EditorShell } from '../ui/EditorShell'
import { exportXlsx } from '../export/xlsx'
import { exportSheetPdf } from '../export/pdf/sheetPdf'
import { a1 } from '../core/sheet/model'

export function SheetEditorPage() {
  const { id } = useParams<{ id: string }>()
  const s = useSheetEditorStore()
  const [missing, setMissing] = useState(false)
  const editRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    let live = true
    s.load(id).then(() => live && useSheetEditorStore.getState().template === null && setMissing(true))
    return () => { live = false; s.unload() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Flush pending autosave on unload.
  useEffect(() => {
    const flush = () => {
      const st = useSheetEditorStore.getState()
      if (st.dirty) void st.save()
    }
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [])

  const setContext = useCallback(
    (scenarioId: string, recordId: string, ctx: Parameters<typeof s.setContext>[2]) => {
      useSheetEditorStore.getState().setContext(scenarioId, recordId, ctx)
    },
    [s.setContext],
  )

  if (missing) {
    return <div className="flex h-full items-center justify-center text-sm text-ink-3">Template not found.</div>
  }
  const tpl = s.template
  if (!tpl?.sheet) {
    return <div className="flex h-full items-center justify-center text-sm text-ink-3">Loading…</div>
  }

  const activeCellObj = tpl.sheet.cells[a1(s.activeCell.row, s.activeCell.col)]
  const formulaBarValue = s.editing
    ? s.editText
    : activeCellObj?.f
      ? `=${activeCellObj.f}`
      : activeCellObj?.v !== undefined
        ? String(activeCellObj.v)
        : ''

  return (
    <EditorShell template={tpl} dirty={s.dirty}>
      <div className="flex h-full flex-col bg-chrome">
        <SheetToolbar
          onExportXlsx={() => void exportXlsx(tpl.sheet!, tpl.name)}
          onExportPdf={() => void exportSheetPdf(tpl.sheet!, tpl.name, tpl.page)}
        />
        <DataContextBar
          scenarioId={s.scenarioId}
          recordId={s.recordId}
          setContext={setContext}
        />
        <div className="flex shrink-0 items-center gap-2 border-b border-line bg-white px-2 py-1">
          <span className="font-mono text-[11.5px] text-ink-soft">fx</span>
          <input
            ref={editRef}
            className="h-6 flex-1 rounded border border-line px-2 font-mono text-[12px] outline-none focus:border-accent"
            value={formulaBarValue}
            placeholder="Value or =FORMULA()"
            onChange={(e) => {
              if (!s.editing) s.startEdit(s.activeCell, e.target.value)
              else useSheetEditorStore.setState({ editText: e.target.value })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); s.commitEdit(); e.currentTarget.blur() }
              if (e.key === 'Escape') { s.cancelEdit(); e.currentTarget.blur() }
            }}
            onBlur={() => { if (s.editing) s.commitEdit() }}
          />
        </div>
        <div className="min-h-0 flex-1">
          <SheetGrid onRequestRowSource={() => { /* toolbar owns the binding modal */ }} />
        </div>
      </div>
    </EditorShell>
  )
}
