import { describe, expect, it } from 'vitest'
import { parsePath, resolvePath, listPaths } from '../../src/core/binding/paths'
import { applyFormat, formatDate, formatCurrency, resolveBinding } from '../../src/core/binding/format'
import { evaluateCondition } from '../../src/core/binding/conditions'

const ctx = {
  student: { fullName: 'Ngo Bell Acha', class: 'Form 5A' },
  payment: { amount: 75000, date: '2025-09-12', method: 'Cash' },
  academicReport: {
    subjects: [
      { subject: 'Mathematics', score: 15 },
      { subject: 'Physics', score: 9 },
    ],
    decision: 'Admitted',
  },
}

describe('path resolution', () => {
  it('resolves nested paths', () => {
    expect(resolvePath(ctx, 'student.fullName')).toBe('Ngo Bell Acha')
    expect(resolvePath(ctx, 'academicReport.subjects[1].score')).toBe(9)
  })
  it('returns undefined for missing paths', () => {
    expect(resolvePath(ctx, 'student.missing')).toBeUndefined()
    expect(resolvePath(ctx, 'academicReport.subjects[9].score')).toBeUndefined()
  })
  it('rejects unsafe path segments', () => {
    expect(parsePath('a.__proto__.b')).toBeNull()
    expect(parsePath('a.constructor')).toBeNull()
    expect(resolvePath(ctx, 'student.constructor.name')).toBeUndefined()
  })
  it('rejects malformed paths', () => {
    expect(parsePath('a..b')).toBeNull()
    expect(parsePath('foo()')).toBeNull()
    expect(parsePath('a[evil]')).toBeNull()
  })
  it('lists collection paths with [] markers', () => {
    const paths = listPaths(ctx)
    expect(paths).toContain('academicReport.subjects[]')
    expect(paths).toContain('academicReport.subjects[].subject')
  })
})

describe('formatting', () => {
  it('formats dates', () => {
    expect(formatDate('2025-09-12', 'DD/MM/YYYY')).toBe('12/09/2025')
    expect(formatDate('2025-09-12', 'YYYY-MM-DD')).toBe('2025-09-12')
    expect(formatDate('not-a-date', 'DD/MM/YYYY')).toBe('')
  })
  it('formats currency', () => {
    expect(formatCurrency(75000, 'XAF')).toContain('75,000')
  })
  it('applies transforms', () => {
    expect(applyFormat('hello world', { type: 'title' })).toBe('Hello World')
    expect(applyFormat('ABC', { type: 'lower' })).toBe('abc')
    expect(applyFormat(3.14159, { type: 'number', decimals: 2 })).toBe('3.14')
  })
  it('resolves bindings with fallback', () => {
    expect(resolveBinding(ctx, { path: 'student.missing', fallback: '—' })).toBe('—')
    expect(resolveBinding(ctx, { path: 'student.fullName' })).toBe('Ngo Bell Acha')
    expect(resolveBinding(ctx, { path: 'payment.date', format: { type: 'date', pattern: 'DD/MM/YYYY' } })).toBe('12/09/2025')
  })
})

describe('conditions', () => {
  it('evaluates operators', () => {
    expect(evaluateCondition(ctx, { path: 'student.fullName', op: 'exists' })).toBe(true)
    expect(evaluateCondition(ctx, { path: 'student.missing', op: 'exists' })).toBe(false)
    expect(evaluateCondition(ctx, { path: 'academicReport.decision', op: 'eq', value: 'Admitted' })).toBe(true)
    expect(evaluateCondition(ctx, { path: 'payment.amount', op: 'gte', value: 75000 })).toBe(true)
    expect(evaluateCondition(ctx, { path: 'payment.amount', op: 'lt', value: 100 })).toBe(false)
    expect(evaluateCondition(ctx, { path: 'academicReport.subjects', op: 'empty' })).toBe(false)
  })
})
