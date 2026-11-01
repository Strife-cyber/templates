import type {
  DocumentDataContext,
  DocumentDataProvider,
  RecordRef,
  ScenarioInfo,
} from '../types'
import { buildReports, CLASS, PAYMENTS, SCHOOL, STUDENTS } from './seed'

const studentById = new Map(STUDENTS.map((s) => [s.id, s]))
const reports = buildReports()

function withClass(student: (typeof STUDENTS)[number]) {
  return { ...student, class: CLASS.name, academicYear: CLASS.academicYear }
}

/**
 * Scenarios describe the shape of a resolved context. `class-pv` returns a
 * flattened per-student collection so spreadsheet row binding can map columns
 * directly onto item fields.
 */
const SCENARIOS: ScenarioInfo[] = [
  {
    id: 'payment-receipt',
    label: 'Payment receipt',
    description: 'One payment transaction with student and school details.',
    contextKeys: ['school', 'student', 'payment', 'receipt'],
  },
  {
    id: 'report-card',
    label: 'Report card',
    description: 'One student with a full academic report (subjects collection).',
    contextKeys: ['school', 'student', 'academicReport'],
  },
  {
    id: 'class-pv',
    label: 'Class report (PV)',
    description: 'A class list of students with per-subject scores, averages and ranks.',
    contextKeys: ['school', 'klass', 'students'],
  },
  {
    id: 'student-profile',
    label: 'Student profile',
    description: 'One student with school details.',
    contextKeys: ['school', 'student'],
  },
  {
    id: 'class-register',
    label: 'Class register',
    description: 'A class list of students (no results).',
    contextKeys: ['school', 'klass', 'students'],
  },
]

export class DemoProvider implements DocumentDataProvider {
  readonly id = 'demo'
  readonly label = 'Demo school data'

  async listScenarios(): Promise<ScenarioInfo[]> {
    return SCENARIOS
  }

  async listRecords(scenarioId: string): Promise<RecordRef[]> {
    switch (scenarioId) {
      case 'payment-receipt':
        return PAYMENTS.map((p) => ({
          id: p.reference,
          label: `${p.reference} — ${studentById.get(p.studentId)?.fullName ?? p.studentId}`,
          detail: `${p.amount.toLocaleString('en-US')} ${p.currency} · ${p.date} · ${p.method}`,
        }))
      case 'report-card':
        return CLASS.studentIds.map((id) => ({
          id,
          label: studentById.get(id)?.fullName ?? id,
          detail: `${CLASS.name} · ${CLASS.academicYear} · Term 1`,
        }))
      case 'student-profile':
        return STUDENTS.map((s) => ({
          id: s.id,
          label: s.fullName,
          detail: `${s.registrationNumber} · ${CLASS.name}`,
        }))
      case 'class-pv':
      case 'class-register':
        return [{ id: CLASS.id, label: CLASS.name, detail: `${CLASS.academicYear} · ${CLASS.studentIds.length} students` }]
      default:
        return []
    }
  }

  async sampleContext(scenarioId: string): Promise<DocumentDataContext> {
    const first = (await this.listRecords(scenarioId))[0]
    return this.resolve(scenarioId, first?.id ?? '')
  }

  async resolve(scenarioId: string, recordId: string): Promise<DocumentDataContext> {
    switch (scenarioId) {
      case 'payment-receipt': {
        const payment = PAYMENTS.find((p) => p.reference === recordId) ?? PAYMENTS[0]!
        const student = studentById.get(payment.studentId)
        return {
          school: SCHOOL,
          student: student ? withClass(student) : null,
          payment: {
            reference: payment.reference,
            amount: payment.amount,
            currency: payment.currency,
            method: payment.method,
            date: payment.date,
            purpose: payment.purpose,
            previousBalance: payment.previousBalance,
            remainingBalance: payment.remainingBalance,
            cashier: payment.cashier,
          },
          receipt: {
            issuedAt: payment.date,
            number: payment.reference,
          },
        }
      }
      case 'report-card': {
        const student = studentById.get(recordId) ?? STUDENTS[0]!
        const report = reports.get(student.id)
        return {
          school: SCHOOL,
          student: withClass(student),
          academicReport: {
            term: 'Term 1',
            academicYear: CLASS.academicYear,
            class: CLASS.name,
            classTeacher: CLASS.classTeacher,
            subjects: report?.subjects ?? [],
            generalAverage: report?.generalAverage ?? 0,
            rank: report?.rank ?? 0,
            classAverage: report?.classAverage ?? 0,
            teacherRemark: report?.teacherRemark ?? '',
            decision: report?.decision ?? '',
          },
        }
      }
      case 'class-pv': {
        const students = CLASS.studentIds.map((id) => {
          const st = studentById.get(id)!
          const r = reports.get(id)
          const results: Record<string, number> = {}
          for (const s of r?.subjects ?? []) results[s.subject] = s.score
          return {
            student: withClass(st),
            results,
            average: r?.generalAverage ?? 0,
            rank: r?.rank ?? 0,
            decision: r?.decision ?? '',
          }
        })
        return { school: SCHOOL, klass: CLASS, students }
      }
      case 'student-profile': {
        const student = studentById.get(recordId) ?? STUDENTS[0]!
        return { school: SCHOOL, student: withClass(student) }
      }
      case 'class-register': {
        return {
          school: SCHOOL,
          klass: CLASS,
          students: CLASS.studentIds.map((id) => ({ student: withClass(studentById.get(id)!) })),
        }
      }
      default:
        return { school: SCHOOL }
    }
  }
}
