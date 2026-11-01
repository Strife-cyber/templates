import { db } from './db'
import { migrateTemplate } from '../core/schema/migrations'
import type { TemplateDoc } from '../core/schema/template'

/**
 * Template persistence behind an interface — a backend API can replace the
 * Dexie implementation without touching stores or pages.
 */
export interface TemplateRepository {
  list(): Promise<TemplateDoc[]>
  get(id: string): Promise<TemplateDoc | undefined>
  put(template: TemplateDoc): Promise<void>
  remove(id: string): Promise<void>
  duplicate(id: string, newId: string, now: string): Promise<TemplateDoc | undefined>
}

export const dexieRepository: TemplateRepository = {
  async list() {
    return db.templates.orderBy('updatedAt').reverse().toArray()
  },
  async get(id) {
    return db.templates.get(id)
  },
  async put(template) {
    await db.templates.put(template)
  },
  async remove(id) {
    await db.templates.delete(id)
  },
  async duplicate(id, newId, now) {
    const src = await db.templates.get(id)
    if (!src) return undefined
    const copy: TemplateDoc = {
      ...structuredClone(src),
      id: newId,
      name: `${src.name} (copy)`,
      createdAt: now,
      updatedAt: now,
    }
    await db.templates.put(copy)
    return copy
  },
}

export function memoryRepository(initial: TemplateDoc[] = []): TemplateRepository {
  const map = new Map(initial.map((t) => [t.id, t]))
  return {
    async list() {
      return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
    async get(id) {
      return map.get(id)
    },
    async put(t) {
      map.set(t.id, t)
    },
    async remove(id) {
      map.delete(id)
    },
    async duplicate(id, newId, now) {
      const src = map.get(id)
      if (!src) return undefined
      const copy: TemplateDoc = {
        ...structuredClone(src),
        id: newId,
        name: `${src.name} (copy)`,
        createdAt: now,
        updatedAt: now,
      }
      map.set(newId, copy)
      return copy
    },
  }
}

/** Serialize a template for export; parses + validates on import. */
export function exportTemplateJson(template: TemplateDoc): string {
  return JSON.stringify(template, null, 2)
}

export type ImportResult =
  | { ok: true; template: TemplateDoc; migratedFrom?: number }
  | { ok: false; error: string; issues?: { path: string; message: string }[] }

export function importTemplateJson(json: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` }
  }
  return migrateTemplate(parsed)
}
