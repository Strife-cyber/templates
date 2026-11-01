import { SCHEMA_VERSION, validateTemplate, type TemplateDoc } from './template'

/**
 * Upgrade an arbitrary JSON payload to the current schema version.
 *
 * Version 1 is the initial schema — there is nothing to migrate yet — but the
 * hook exists so future versions can register transforms here and imports of
 * older exports keep working.
 */
const MIGRATIONS: Record<number, (doc: Record<string, unknown>) => Record<string, unknown>> = {
  // e.g. 1: (doc) => ({ ...doc, schemaVersion: 2, /* renames… */ }),
}

export type MigrateResult =
  | { ok: true; template: TemplateDoc; migratedFrom?: number }
  | { ok: false; error: string; issues?: { path: string; message: string }[] }

export function migrateTemplate(input: unknown): MigrateResult {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, error: 'Template must be a JSON object.' }
  }
  const doc = { ...(input as Record<string, unknown>) }
  const rawVersion = doc.schemaVersion
  const from = typeof rawVersion === 'number' ? rawVersion : undefined

  if (from !== undefined && from > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Template schema v${from} is newer than this application supports (v${SCHEMA_VERSION}).`,
    }
  }

  let current = from ?? SCHEMA_VERSION
  while (current < SCHEMA_VERSION) {
    const step = MIGRATIONS[current]
    if (!step) break
    Object.assign(doc, step(doc))
    current += 1
  }
  doc.schemaVersion = SCHEMA_VERSION

  const validated = validateTemplate(doc)
  if (!validated.ok) {
    return {
      ok: false,
      error: 'Template failed validation.',
      issues: validated.issues,
    }
  }
  return { ok: true, template: validated.template, migratedFrom: from }
}
