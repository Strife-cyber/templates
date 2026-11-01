import { create } from 'zustand'
import { createTemplate } from '../core/schema/factories'
import type { TemplateDoc, TemplateKind, TemplateCategory } from '../core/schema/template'
import {
  dexieRepository,
  importTemplateJson,
  type TemplateRepository,
} from '../persistence/templateRepository'
import { nanoid } from 'nanoid'

interface TemplateState {
  templates: TemplateDoc[]
  loaded: boolean
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  repo: TemplateRepository
  refresh: () => Promise<void>
  create: (input: { name: string; category: TemplateCategory; kind: TemplateKind }) => Promise<TemplateDoc>
  update: (id: string, patch: Partial<TemplateDoc>) => Promise<void>
  persist: (template: TemplateDoc) => Promise<void>
  remove: (id: string) => Promise<void>
  duplicate: (id: string) => Promise<TemplateDoc | undefined>
  rename: (id: string, name: string) => Promise<void>
  importJson: (json: string) => Promise<{ ok: true; template: TemplateDoc } | { ok: false; error: string }>
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],
  loaded: false,
  saveState: 'idle',
  repo: dexieRepository,

  async refresh() {
    const templates = await get().repo.list()
    set({ templates, loaded: true })
  },

  async create(input) {
    const template = createTemplate(input)
    await get().repo.put(template)
    await get().refresh()
    return template
  },

  async update(id, patch) {
    const existing = await get().repo.get(id)
    if (!existing) return
    const next = { ...existing, ...patch, id, updatedAt: new Date().toISOString() }
    await get().repo.put(next)
    set((s) => ({ templates: s.templates.map((t) => (t.id === id ? next : t)) }))
  },

  async persist(template) {
    set({ saveState: 'saving' })
    try {
      await get().repo.put({ ...template, updatedAt: new Date().toISOString() })
      set({ saveState: 'saved' })
    } catch {
      set({ saveState: 'error' })
    }
  },

  async remove(id) {
    await get().repo.remove(id)
    await get().refresh()
  },

  async duplicate(id) {
    const copy = await get().repo.duplicate(id, `tpl_${nanoid(10)}`, new Date().toISOString())
    if (copy) await get().refresh()
    return copy
  },

  async rename(id, name) {
    await get().update(id, { name })
  },

  async importJson(json) {
    const result = importTemplateJson(json)
    if (!result.ok) {
      const detail = result.issues?.map((i) => `${i.path}: ${i.message}`).join('; ')
      return { ok: false as const, error: detail ? `${result.error} ${detail}` : result.error }
    }
    const template = result.template
    // Avoid id collisions with existing templates.
    if (await get().repo.get(template.id)) template.id = `tpl_${nanoid(10)}`
    template.updatedAt = new Date().toISOString()
    await get().repo.put(template)
    await get().refresh()
    return { ok: true as const, template }
  },
}))
