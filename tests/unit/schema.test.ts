import { describe, expect, it } from 'vitest'
import { createTemplate } from '../../src/core/schema/factories'
import { validateTemplate, pageDimensions } from '../../src/core/schema/template'
import { migrateTemplate } from '../../src/core/schema/migrations'
import { importTemplateJson, exportTemplateJson, memoryRepository } from '../../src/persistence/templateRepository'

describe('template schema', () => {
  it('validates a fresh visual template', () => {
    const t = createTemplate({ name: 'Receipt', category: 'financial', kind: 'visual' })
    const res = validateTemplate(JSON.parse(JSON.stringify(t)))
    expect(res.ok).toBe(true)
  })
  it('validates a fresh sheet template', () => {
    const t = createTemplate({ name: 'PV', category: 'academic', kind: 'sheet' })
    const res = validateTemplate(JSON.parse(JSON.stringify(t)))
    expect(res.ok).toBe(true)
    expect(t.sheet?.rowCount).toBeGreaterThan(0)
  })
  it('rejects invalid templates with useful issues', () => {
    const res = validateTemplate({ id: 'x' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.issues.length).toBeGreaterThan(0)
  })
  it('rejects newer schema versions on import', () => {
    const r = migrateTemplate({ schemaVersion: 99 })
    expect(r.ok).toBe(false)
  })
  it('round-trips through export/import JSON', async () => {
    const t = createTemplate({ name: 'RT', category: 'general', kind: 'visual' })
    const r = importTemplateJson(exportTemplateJson(t))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.template.name).toBe('RT')
  })
  it('rejects malformed JSON on import', () => {
    const r = importTemplateJson('{not json')
    expect(r.ok).toBe(false)
  })
})

describe('page config', () => {
  it('computes A4 portrait/landscape dimensions', () => {
    const portrait = pageDimensions({ size: 'A4', orientation: 'portrait', widthMm: 210, heightMm: 297, margins: { top: 0, right: 0, bottom: 0, left: 0 } })
    expect(portrait).toEqual({ widthMm: 210, heightMm: 297 })
    const landscape = pageDimensions({ size: 'A4', orientation: 'landscape', widthMm: 210, heightMm: 297, margins: { top: 0, right: 0, bottom: 0, left: 0 } })
    expect(landscape).toEqual({ widthMm: 297, heightMm: 210 })
  })
})

describe('repository', () => {
  it('supports CRUD + duplicate', async () => {
    const repo = memoryRepository()
    const t = createTemplate({ name: 'A', category: 'general', kind: 'visual' })
    await repo.put(t)
    expect(await repo.get(t.id)).toBeDefined()
    const copy = await repo.duplicate(t.id, 'copy1', new Date().toISOString())
    expect(copy?.name).toBe('A (copy)')
    await repo.remove(t.id)
    expect(await repo.get(t.id)).toBeUndefined()
  })
})
