import { Database } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getProvider } from '../../core/providers/registry'
import type { RecordRef, ScenarioInfo } from '../../core/providers/types'
import { Select } from '../../ui/controls'
import type { DocumentDataContext } from '../../core/providers/types'

/**
 * Lets the user pick which demo scenario + record feeds bindings on the canvas.
 * Changing the record re-resolves bindings live without touching the template.
 * Store-agnostic: both editors pass their own state + setter.
 */
export function DataContextBar({
  scenarioId,
  recordId,
  setContext,
}: {
  scenarioId: string | null
  recordId: string | null
  setContext: (scenarioId: string, recordId: string, ctx: DocumentDataContext) => void
}) {
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([])
  const [records, setRecords] = useState<RecordRef[]>([])

  useEffect(() => {
    void getProvider().listScenarios().then(setScenarios)
  }, [])

  useEffect(() => {
    if (!scenarioId) return
    let cancelled = false
    const load = async () => {
      const provider = getProvider()
      const recs = await provider.listRecords(scenarioId)
      if (cancelled) return
      setRecords(recs)
      const chosen = recs.find((r) => r.id === recordId) ?? recs[0]
      if (chosen) {
        const ctx = await provider.resolve(scenarioId, chosen.id)
        if (!cancelled) setContext(scenarioId, chosen.id, ctx)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [scenarioId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="no-print flex items-center gap-2 border-b border-line bg-panel px-3 py-1.5">
      <Database size={13} className="text-ink-3" />
      <span className="text-[11px] font-medium text-ink-3">Preview data</span>
      <Select
        value={scenarioId ?? ''}
        onChange={(e) => {
          // Capture synchronously: React restores the controlled DOM value to
          // the stale prop while the async continuation is suspended.
          const value = e.target.value
          if (!value) return
          void (async () => {
            const provider = getProvider()
            const recs = await provider.listRecords(value)
            const first = recs[0]
            const ctx = first
              ? await provider.resolve(value, first.id)
              : await provider.sampleContext(value)
            setContext(value, first?.id ?? '', ctx)
          })()
        }}
        className="h-7 text-xs"
      >
        <option value="">Choose data…</option>
        {scenarios.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </Select>
      {scenarioId && records.length > 1 && (
        <Select
          value={recordId ?? ''}
          onChange={async (e) => {
            const ctx = await getProvider().resolve(scenarioId, e.target.value)
            setContext(scenarioId, e.target.value, ctx)
          }}
          className="h-7 min-w-56 text-xs"
        >
          {records.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}{r.detail ? ` — ${r.detail}` : ''}
            </option>
          ))}
        </Select>
      )}
    </div>
  )
}
