import Dexie, { type EntityTable } from 'dexie'
import type { TemplateDoc } from '../core/schema/template'

export const db = new Dexie('document-studio') as Dexie & {
  templates: EntityTable<TemplateDoc, 'id'>
}

db.version(1).stores({
  templates: 'id, name, kind, category, updatedAt',
})
