import { z } from 'zod'

/**
 * Document Studio template schema — version 1.
 *
 * The template is a framework-independent JSON document. Nothing in this file
 * imports React, Dexie, or any library-specific type. `schemaVersion` plus
 * `migrateTemplate` keep saved and imported documents forward-compatible.
 */

export const SCHEMA_VERSION = 1 as const

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const unit = z.number() // millimetres for visual docs, px-ish grid units for sheets

export const formatSpecSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('date'), pattern: z.string().default('DD/MM/YYYY') }),
  z.object({ type: z.literal('currency'), currency: z.string().default('XAF') }),
  z.object({ type: z.literal('number'), decimals: z.number().int().min(0).max(6).default(0) }),
  z.object({ type: z.literal('upper') }),
  z.object({ type: z.literal('lower') }),
  z.object({ type: z.literal('title') }),
])
export type FormatSpec = z.infer<typeof formatSpecSchema>

export const bindingSchema = z.object({
  /** Dot path resolved against the document's data context, e.g. `student.fullName`. */
  path: z.string().min(1),
  format: formatSpecSchema.optional(),
  /** Rendered when the resolved value is null/undefined/empty. */
  fallback: z.string().optional(),
})
export type Binding = z.infer<typeof bindingSchema>

export const conditionSchema = z.object({
  path: z.string().min(1),
  op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'exists', 'empty', 'contains']),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
})
export type Condition = z.infer<typeof conditionSchema>

// ---------------------------------------------------------------------------
// Visual document schema
// ---------------------------------------------------------------------------

export const pageSizeSchema = z.enum(['A4', 'A3', 'custom'])
export const orientationSchema = z.enum(['portrait', 'landscape'])

export const pageConfigSchema = z
  .object({
    size: pageSizeSchema.default('A4'),
    orientation: orientationSchema.default('portrait'),
    /** mm; required when size === 'custom'. */
    widthMm: z.number().positive().default(210),
    heightMm: z.number().positive().default(297),
    margins: z
      .object({
        top: z.number().min(0).default(10),
        right: z.number().min(0).default(10),
        bottom: z.number().min(0).default(10),
        left: z.number().min(0).default(10),
      })
      .default({ top: 10, right: 10, bottom: 10, left: 10 }),
  })
  .refine(
    (p) => p.size !== 'custom' || (p.widthMm > 0 && p.heightMm > 0),
    { message: 'custom page size requires widthMm and heightMm' },
  )
export type PageConfig = z.infer<typeof pageConfigSchema>

export const elementTypeSchema = z.enum([
  'text',
  'richText',
  'image',
  'rect',
  'line',
  'divider',
  'table',
  'qr',
  'pageNumber',
])
export type ElementType = z.infer<typeof elementTypeSchema>

export const textStyleSchema = z.object({
  fontFamily: z.string().default('Inter'),
  fontSize: z.number().positive().default(11), // pt
  fontWeight: z.union([z.literal('normal'), z.literal('bold'), z.number()]).default('normal'),
  fontStyle: z.enum(['normal', 'italic']).default('normal'),
  underline: z.boolean().default(false),
  align: z.enum(['left', 'center', 'right', 'justify']).default('left'),
  valign: z.enum(['top', 'middle', 'bottom']).default('top'),
  color: z.string().default('#111827'),
  lineHeight: z.number().positive().default(1.25),
  letterSpacing: z.number().default(0),
})
export type TextStyle = z.infer<typeof textStyleSchema>

export const boxStyleSchema = z.object({
  background: z.string().default('transparent'),
  borderWidth: z.number().min(0).default(0),
  borderColor: z.string().default('#111827'),
  borderStyle: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
  borderRadius: z.number().min(0).default(0), // mm
  padding: z.number().min(0).default(0), // mm
  opacity: z.number().min(0).max(1).default(1),
})
export type BoxStyle = z.infer<typeof boxStyleSchema>

const geometry = {
  x: z.number(), // mm from page content-box origin
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  rotation: z.number().default(0),
  z: z.number().int().default(0),
}

export const tableColumnSchema = z.object({
  id: z.string(),
  header: z.string(),
  widthMm: z.number().positive(),
  align: z.enum(['left', 'center', 'right']).default('left'),
  binding: bindingSchema.optional(),
})
export type TableColumn = z.infer<typeof tableColumnSchema>

export const tablePropsSchema = z.object({
  columns: z.array(tableColumnSchema).min(1),
  /** Dot path to the collection repeated over rows, e.g. `academicReport.subjects`. */
  rows: bindingSchema,
  headerStyle: textStyleSchema.partial().optional(),
  rowStyle: textStyleSchema.partial().optional(),
  rowHeightMm: z.number().positive().default(8),
  headerHeightMm: z.number().positive().default(9),
  zebra: z.boolean().default(false),
  showHeader: z.boolean().default(true),
})
export type TableProps = z.infer<typeof tablePropsSchema>

export const visualElementSchema = z.object({
  id: z.string(),
  type: elementTypeSchema,
  ...geometry,
  binding: bindingSchema.optional(),
  visibleWhen: conditionSchema.optional(),
  textStyle: textStyleSchema.partial().optional(),
  boxStyle: boxStyleSchema.partial().optional(),
  /** Per-type payload. Kept loose here; narrowed by element renderers. */
  props: z.record(z.string(), z.unknown()).default({}),
})
export type VisualElement = z.infer<typeof visualElementSchema>

export const visualPageSchema = z.object({
  id: z.string(),
  elements: z.array(visualElementSchema).default([]),
})
export type VisualPage = z.infer<typeof visualPageSchema>

// ---------------------------------------------------------------------------
// Spreadsheet schema
// ---------------------------------------------------------------------------

export const cellOriginSchema = z.enum(['manual', 'source', 'formula', 'overridden'])
export type CellOrigin = z.infer<typeof cellOriginSchema>

export const cellStyleSchema = z.object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  fontSize: z.number().positive().optional(),
  fontFamily: z.string().optional(),
  color: z.string().optional(),
  background: z.string().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  valign: z.enum(['top', 'middle', 'bottom']).optional(),
  wrap: z.boolean().optional(),
  /** number format: 'text' | 'number' | 'currency' | 'percent' | 'date' */
  format: z.enum(['text', 'number', 'currency', 'percent', 'date']).optional(),
  decimals: z.number().int().min(0).max(6).optional(),
  borders: z
    .object({
      top: z.boolean().optional(),
      right: z.boolean().optional(),
      bottom: z.boolean().optional(),
      left: z.boolean().optional(),
      color: z.string().optional(),
      style: z.enum(['solid', 'dashed', 'dotted']).optional(),
    })
    .optional(),
})
export type CellStyle = z.infer<typeof cellStyleSchema>

export const cellSchema = z.object({
  /** Literal value (number | string | boolean | null). */
  v: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  /** Formula text, with or without the leading `=`. */
  f: z.string().optional(),
  /** Binding path this cell was populated from. */
  b: z.string().optional(),
  origin: cellOriginSchema.default('manual'),
  style: cellStyleSchema.optional(),
})
export type SheetCell = z.infer<typeof cellSchema>

export const mergeSchema = z.object({
  /** Inclusive A1 corners, e.g. { start: 'B2', end: 'D2' }. */
  start: z.string(),
  end: z.string(),
})
export type Merge = z.infer<typeof mergeSchema>

export const rowSourceSchema = z.object({
  /** Provider source name, e.g. 'class.students'. */
  source: z.string(),
  /** Dot path within the resolved source to the row collection. */
  collectionPath: z.string(),
  /** First (1-based) grid row the collection is written to. */
  startRow: z.number().int().positive(),
  /** Column letter -> dot path inside one collection item. */
  mapping: z.record(z.string(), z.string()),
  /** Marks cells written by the last data refresh, for origin tracking. */
  generatedAt: z.string().optional(),
})
export type RowSource = z.infer<typeof rowSourceSchema>

export const sheetDocSchema = z.object({
  rowCount: z.number().int().positive().default(60),
  colCount: z.number().int().positive().default(12),
  /** Keyed by A1 address. */
  cells: z.record(z.string(), cellSchema).default({}),
  /** Keyed by 1-based column index; px at 100% zoom. */
  colWidths: z.record(z.string(), z.number().positive()).default({}),
  /** Keyed by 1-based row index. */
  rowHeights: z.record(z.string(), z.number().positive()).default({}),
  merges: z.array(mergeSchema).default([]),
  frozenRows: z.number().int().min(0).default(0),
  frozenCols: z.number().int().min(0).default(0),
  rowSource: rowSourceSchema.nullable().default(null),
  print: z
    .object({
      size: pageSizeSchema.default('A4'),
      orientation: orientationSchema.default('landscape'),
      /** A1 range, e.g. 'A1:H40'; null = used range. */
      area: z.string().nullable().default(null),
      repeatHeaderRows: z.number().int().min(0).default(1),
    })
    .default({ size: 'A4', orientation: 'landscape', area: null, repeatHeaderRows: 1 }),
})
export type SheetDoc = z.infer<typeof sheetDocSchema>

// ---------------------------------------------------------------------------
// Template root
// ---------------------------------------------------------------------------

export const templateCategorySchema = z.enum([
  'academic',
  'financial',
  'administrative',
  'general',
])
export type TemplateCategory = z.infer<typeof templateCategorySchema>

export const templateKindSchema = z.enum(['visual', 'sheet'])
export type TemplateKind = z.infer<typeof templateKindSchema>

export const templateDocSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().default(''),
    category: templateCategorySchema.default('general'),
    kind: templateKindSchema,
    page: pageConfigSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
    /** Visual templates: ordered pages. */
    pages: z.array(visualPageSchema).optional(),
    /** Sheet templates: the workbook. */
    sheet: sheetDocSchema.optional(),
  })
  .refine((t) => (t.kind === 'visual' ? !!t.pages?.length : !!t.sheet), {
    message: 'visual templates need pages[]; sheet templates need sheet',
  })
export type TemplateDoc = z.infer<typeof templateDocSchema>

// ---------------------------------------------------------------------------
// Factories and helpers
// ---------------------------------------------------------------------------

export const PAGE_SIZES_MM: Record<'A4' | 'A3', { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
}

export function pageDimensions(page: PageConfig): { widthMm: number; heightMm: number } {
  if (page.size === 'custom') return { widthMm: page.widthMm, heightMm: page.heightMm }
  const { w, h } = PAGE_SIZES_MM[page.size]
  return page.orientation === 'portrait'
    ? { widthMm: w, heightMm: h }
    : { widthMm: h, heightMm: w }
}

export interface ValidationIssue {
  path: string
  message: string
}

export function validateTemplate(input: unknown):
  | { ok: true; template: TemplateDoc }
  | { ok: false; issues: ValidationIssue[] } {
  const parsed = templateDocSchema.safeParse(input)
  if (parsed.success) return { ok: true, template: parsed.data }
  return {
    ok: false,
    issues: parsed.error.issues.map((i) => ({
      path: i.path.join('.') || '(root)',
      message: i.message,
    })),
  }
}
