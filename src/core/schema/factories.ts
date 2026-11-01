import { nanoid } from 'nanoid'
import {
  SCHEMA_VERSION,
  type PageConfig,
  type SheetDoc,
  type TemplateCategory,
  type TemplateDoc,
  type TemplateKind,
} from './template'

export function defaultPageConfig(partial: Partial<PageConfig> = {}): PageConfig {
  return {
    size: 'A4',
    orientation: 'portrait',
    widthMm: 210,
    heightMm: 297,
    margins: { top: 12, right: 12, bottom: 12, left: 12 },
    ...partial,
  }
}

export function emptySheetDoc(): SheetDoc {
  return {
    rowCount: 80,
    colCount: 12,
    cells: {},
    colWidths: {},
    rowHeights: {},
    merges: [],
    frozenRows: 1,
    frozenCols: 1,
    rowSource: null,
    print: { size: 'A4', orientation: 'landscape', area: null, repeatHeaderRows: 1 },
  }
}

export function createTemplate(input: {
  name: string
  category: TemplateCategory
  kind: TemplateKind
  description?: string
}): TemplateDoc {
  const now = new Date().toISOString()
  const base: TemplateDoc = {
    schemaVersion: SCHEMA_VERSION,
    id: `tpl_${nanoid(10)}`,
    name: input.name,
    description: input.description ?? '',
    category: input.category,
    kind: input.kind,
    page: defaultPageConfig(input.kind === 'sheet' ? { orientation: 'landscape' } : {}),
    createdAt: now,
    updatedAt: now,
  }
  if (input.kind === 'visual') {
    base.pages = [{ id: `pg_${nanoid(8)}`, elements: [] }]
  } else {
    base.sheet = emptySheetDoc()
  }
  return base
}
