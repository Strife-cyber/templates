import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { TemplateDoc, VisualElement, VisualPage } from '../core/schema/template'
import type { DocumentDataContext } from '../core/providers/types'
import { useTemplateStore } from './templateStore'

const MAX_HISTORY = 60

interface History {
  past: VisualPage[][]
  future: VisualPage[][]
  lastKey: string | null
}

interface VisualEditorState {
  template: TemplateDoc | null
  pageIndex: number
  zoom: number
  selectedIds: string[]
  showGrid: boolean
  snap: boolean
  dirty: boolean
  scenarioId: string | null
  recordId: string | null
  context: DocumentDataContext
  history: History

  load: (template: TemplateDoc) => void
  unload: () => void
  setZoom: (zoom: number) => void
  setPageIndex: (i: number) => void
  toggleGrid: () => void
  toggleSnap: () => void
  setContext: (scenarioId: string, recordId: string, context: DocumentDataContext) => void

  select: (ids: string[], additive?: boolean) => void
  clearSelection: () => void

  /** Apply a structural change to the template's pages. */
  mutate: (fn: (pages: VisualPage[]) => void, historyKey?: string) => void
  addElement: (el: Omit<VisualElement, 'id'>) => VisualElement
  updateElement: (id: string, patch: Partial<VisualElement>, historyKey?: string) => void
  updateProps: (id: string, props: Record<string, unknown>, historyKey?: string) => void
  deleteSelected: () => void
  duplicateSelected: () => void
  reorderSelected: (op: 'front' | 'back' | 'forward' | 'backward') => void
  addPage: () => void
  removePage: (index: number) => void

  undo: () => void
  redo: () => void
  save: () => void
}

function snapshot(pages: VisualPage[]): VisualPage[] {
  return structuredClone(pages)
}

export const useVisualEditorStore = create<VisualEditorState>((set, get) => {
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const t = get().template
      if (t) void useTemplateStore.getState().persist(t)
      set({ dirty: false })
    }, 800)
  }

  const pushHistory = (key: string | undefined) => {
    const { template, history } = get()
    if (!template?.pages) return
    if (key && key === history.lastKey) return // coalesce continuous gestures
    const past = [...history.past, snapshot(template.pages)].slice(-MAX_HISTORY)
    set({ history: { past, future: [], lastKey: key ?? null } })
  }

  return {
    template: null,
    pageIndex: 0,
    zoom: 1,
    selectedIds: [],
    showGrid: true,
    snap: true,
    dirty: false,
    scenarioId: null,
    recordId: null,
    context: {},
    history: { past: [], future: [], lastKey: null },

    load(template) {
      set({
        template,
        pageIndex: 0,
        selectedIds: [],
        dirty: false,
        history: { past: [], future: [], lastKey: null },
        scenarioId: null,
        recordId: null,
        context: {},
      })
    },

    unload() {
      if (saveTimer) clearTimeout(saveTimer)
      const t = get().template
      if (t && get().dirty) void useTemplateStore.getState().persist(t)
      set({ template: null })
    },

    setZoom: (zoom) => set({ zoom: Math.min(4, Math.max(0.25, zoom)) }),
    setPageIndex: (pageIndex) => set({ pageIndex, selectedIds: [] }),
    toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
    toggleSnap: () => set((s) => ({ snap: !s.snap })),

    setContext: (scenarioId, recordId, context) => set({ scenarioId, recordId, context }),

    select: (ids, additive = false) =>
      set((s) => ({
        selectedIds: additive ? [...new Set([...s.selectedIds, ...ids])] : ids,
      })),
    clearSelection: () => set({ selectedIds: [] }),

    mutate(fn, historyKey) {
      const { template } = get()
      if (!template?.pages) return
      pushHistory(historyKey)
      const pages = structuredClone(template.pages)
      fn(pages)
      set({ template: { ...template, pages }, dirty: true })
      scheduleSave()
    },

    addElement(el) {
      const element: VisualElement = { ...el, id: `el_${nanoid(8)}` }
      get().mutate((pages) => {
        const page = pages[get().pageIndex]
        if (page) page.elements.push(element)
      })
      set({ selectedIds: [element.id] })
      return element
    },

    updateElement(id, patch, historyKey) {
      get().mutate((pages) => {
        for (const page of pages) {
          const el = page.elements.find((e) => e.id === id)
          if (el) Object.assign(el, patch)
        }
      }, historyKey)
    },

    updateProps(id, props, historyKey) {
      get().mutate((pages) => {
        for (const page of pages) {
          const el = page.elements.find((e) => e.id === id)
          if (el) el.props = { ...el.props, ...props }
        }
      }, historyKey)
    },

    deleteSelected() {
      const ids = new Set(get().selectedIds)
      if (!ids.size) return
      get().mutate((pages) => {
        for (const page of pages) page.elements = page.elements.filter((e) => !ids.has(e.id))
      })
      set({ selectedIds: [] })
    },

    duplicateSelected() {
      const { template, pageIndex, selectedIds } = get()
      const page = template?.pages?.[pageIndex]
      if (!page || !selectedIds.length) return
      const clones = page.elements
        .filter((e) => selectedIds.includes(e.id))
        .map((e) => ({
          ...structuredClone(e),
          id: `el_${nanoid(8)}`,
          x: e.x + 5,
          y: e.y + 5,
        }))
      get().mutate((pages) => pages[pageIndex]?.elements.push(...clones))
      set({ selectedIds: clones.map((c) => c.id) })
    },

    reorderSelected(op) {
      const ids = new Set(get().selectedIds)
      if (!ids.size) return
      get().mutate((pages) => {
        for (const page of pages) {
          const els = page.elements.filter((e) => ids.has(e.id))
          if (!els.length) continue
          const max = Math.max(...page.elements.map((e) => e.z))
          const min = Math.min(...page.elements.map((e) => e.z))
          for (const el of els) {
            if (op === 'front') el.z = max + 1
            else if (op === 'back') el.z = min - 1
            else if (op === 'forward') el.z += 1
            else el.z -= 1
          }
        }
      })
    },

    addPage() {
      get().mutate((pages) => {
        pages.push({ id: `pg_${nanoid(8)}`, elements: [] })
      })
      set({ pageIndex: (get().template?.pages?.length ?? 1) - 1 })
    },

    removePage(index) {
      const count = get().template?.pages?.length ?? 0
      if (count <= 1) return
      get().mutate((pages) => {
        pages.splice(index, 1)
      })
      set({ pageIndex: Math.max(0, Math.min(get().pageIndex, count - 2)) })
    },

    undo() {
      const { template, history } = get()
      const prev = history.past.at(-1)
      if (!template?.pages || !prev) return
      set({
        template: { ...template, pages: prev },
        history: {
          past: history.past.slice(0, -1),
          future: [snapshot(template.pages), ...history.future],
          lastKey: null,
        },
        dirty: true,
      })
      scheduleSave()
    },

    redo() {
      const { template, history } = get()
      const next = history.future[0]
      if (!template?.pages || !next) return
      set({
        template: { ...template, pages: next },
        history: {
          past: [...history.past, snapshot(template.pages)],
          future: history.future.slice(1),
          lastKey: null,
        },
        dirty: true,
      })
      scheduleSave()
    },

    save() {
      if (saveTimer) clearTimeout(saveTimer)
      const t = get().template
      if (t) void useTemplateStore.getState().persist(t)
      set({ dirty: false })
    },
  }
})
