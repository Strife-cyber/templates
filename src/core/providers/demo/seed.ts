/**
 * Deterministic demo seed data for the Document Studio POC.
 *
 * Deliberately includes edge cases: very long names, a missing photo, a
 * student with extra subjects, sparse optional fields, and varied payment
 * scenarios (partial payment, overpayment-free balances, cash/mobile).
 */

export interface SeedStudent {
  id: string
  fullName: string
  registrationNumber: string
  dateOfBirth: string
  gender: 'M' | 'F'
  photo: string | null
}

export interface SeedSubject {
  code: string
  name: string
  coefficient: number
  teacher: string
}

export interface SeedReport {
  studentId: string
  subjects: { subject: string; score: number; coefficient: number; rank: number; remark: string }[]
  generalAverage: number
  rank: number
  classAverage: number
  teacherRemark: string
  decision: 'Admitted' | 'Repeat' | 'Conditional'
}

export interface SeedPayment {
  reference: string
  studentId: string
  amount: number
  currency: string
  method: 'Cash' | 'Mobile Money' | 'Bank Transfer'
  date: string
  purpose: string
  previousBalance: number
  remainingBalance: number
  cashier: string
}

// ---------------------------------------------------------------------------
// Deterministic helpers
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(0x5eed)

const round1 = (n: number) => Math.round(n * 10) / 10

export function initialsPhoto(name: string, hue: number): string {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="48" fill="hsl(${hue} 45% 55%)"/><text x="48" y="58" font-family="sans-serif" font-size="34" font-weight="600" fill="#fff" text-anchor="middle">${initials}</text></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

export const SCHOOL = {
  name: 'College Bilingue Saint-André',
  motto: 'Knowledge · Discipline · Excellence',
  address: 'B.P. 4521, Quartier Bonanjo, Douala',
  telephone: '+237 233 42 68 90',
  email: 'contact@cbsa-edu.cm',
  website: 'www.cbsa-edu.cm',
  registrationNumber: 'MINEDUB/REG/2004/01873',
  logo: `data:image/svg+xml;base64,${btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" rx="16" fill="#14532d"/><text x="60" y="52" font-family="serif" font-size="40" font-weight="700" fill="#fff" text-anchor="middle">CB</text><text x="60" y="80" font-family="serif" font-size="20" fill="#bbf7d0" text-anchor="middle">SA</text></svg>`,
  )}`,
}

export const SUBJECTS: SeedSubject[] = [
  { code: 'MATH', name: 'Mathematics', coefficient: 4, teacher: 'Mr. Nkeng P.' },
  { code: 'PHY', name: 'Physics', coefficient: 3, teacher: 'Mrs. Etoundi C.' },
  { code: 'CHEM', name: 'Chemistry', coefficient: 2, teacher: 'Mr. Abena J.' },
  { code: 'BIO', name: 'Biology', coefficient: 2, teacher: 'Ms. Kouam L.' },
  { code: 'ENG', name: 'English', coefficient: 3, teacher: 'Mrs. Fon N.' },
  { code: 'FRE', name: 'French', coefficient: 3, teacher: 'M. Mbarga S.' },
  { code: 'HIST', name: 'History', coefficient: 2, teacher: 'Mr. Tchoupo R.' },
  { code: 'GEO', name: 'Geography', coefficient: 2, teacher: 'Mrs. Biya A.' },
  { code: 'ICT', name: 'Computer Science', coefficient: 2, teacher: 'Mr. Kamdem F.' },
]

const FIRST = [
  'Acha', 'Bertrand', 'Chantal', 'Dilan', 'Estelle', 'Fabrice', 'Gisèle', 'Hermann', 'Inès',
  'Junior', 'Kamila', 'Landry', 'Merveille', 'Nadia', 'Olive', 'Parfait', 'Queency', 'Rodrigue',
  'Sandrine', 'Thierry', 'Ursule', 'Valère', 'Wilfried', 'Xaverine', 'Yannick', 'Zita',
]
const LAST = [
  'Ngo Bell', 'Tchoupo', 'Ekambi', 'Mbappe', 'Fouda', 'Onana', 'Kamdem', 'Biloa',
  'Ngnie Kamga', 'Etoundi', 'Wamba', 'Siewe', 'Nkoulou', 'Abena', 'Fotso', 'Manga',
]

export const STUDENTS: SeedStudent[] = FIRST.map((first, i) => {
  const last = LAST[(i * 7 + 3) % LAST.length] ?? 'Ngo'
  const fullName = i === 11
    ? `${last} Nkoulou-Mbarga Etoundi ${first} Marie-Claire` // deliberate long name
    : `${last} ${first}`
  return {
    id: `STU-${String(i + 1).padStart(3, '0')}`,
    fullName,
    registrationNumber: `CBSA/25/${String(1040 + i)}`,
    dateOfBirth: `20${8 + (i % 3)}-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + ((i * 5) % 27)).padStart(2, '0')}`,
    gender: i % 2 ? 'F' : 'M',
    photo: i === 6 ? null : initialsPhoto(fullName, (i * 37) % 360), // one missing photo
  }
})

export const CLASS = {
  id: 'CLS-F5A',
  name: 'Form 5A',
  level: 'Form 5',
  academicYear: '2025/2026',
  classTeacher: 'Mrs. Etoundi C.',
  studentIds: STUDENTS.slice(0, 24).map((s) => s.id),
}

const REMARKS_PASS = ['Excellent', 'Very good', 'Good', 'Fair', 'Satisfactory']
const REMARKS_FAIL = ['Weak', 'Very weak', 'Needs effort', 'Unsatisfactory']

function remarkFor(score: number): string {
  return score >= 10
    ? (REMARKS_PASS[Math.floor(rand() * REMARKS_PASS.length)] ?? 'Good')
    : (REMARKS_FAIL[Math.floor(rand() * REMARKS_FAIL.length)] ?? 'Weak')
}

export function buildReports(): Map<string, SeedReport> {
  const reports = new Map<string, SeedReport>()
  const allScores: number[] = []
  const perStudent = CLASS.studentIds.map((id, idx) => {
    // Varied ability profiles; student 8 takes an extra "Literature" subject.
    const ability = 4 + rand() * 14
    const subjectList =
      idx === 8 ? [...SUBJECTS, { code: 'LIT', name: 'Literature', coefficient: 1, teacher: 'Mrs. Fon N.' }] : SUBJECTS
    const subjects = subjectList.map((s, si) => {
      const noise = (rand() - 0.5) * 8
      const score = Math.max(0, Math.min(20, round1(ability + noise + (si % 3))))
      return { subject: s.name, score, coefficient: s.coefficient, rank: 0, remark: remarkFor(score) }
    })
    const totalCoef = subjects.reduce((a, s) => a + s.coefficient, 0)
    const generalAverage = round1(subjects.reduce((a, s) => a + s.score * s.coefficient, 0) / totalCoef)
    allScores.push(generalAverage)
    return { studentId: id, subjects, generalAverage }
  })
  const sorted = [...perStudent].sort((a, b) => b.generalAverage - a.generalAverage)
  const classAverage = round1(allScores.reduce((a, b) => a + b, 0) / allScores.length)
  for (const [i, s] of sorted.entries()) {
    const avg = s.generalAverage
    reports.set(s.studentId, {
      studentId: s.studentId,
      subjects: s.subjects.map((sub, j) => ({ ...sub, rank: j + 1 })),
      generalAverage: avg,
      rank: i + 1,
      classAverage,
      teacherRemark: avg >= 14 ? 'Excellent term. Keep it up.' : avg >= 10 ? 'Fair term. Can do better.' : 'Weak term. Must work harder.',
      decision: avg >= 10 ? 'Admitted' : avg >= 8 ? 'Conditional' : 'Repeat',
    })
  }
  return reports
}

export const PAYMENTS: SeedPayment[] = [
  { reference: 'PAY-2025-0891', studentId: 'STU-001', amount: 75_000, currency: 'XAF', method: 'Mobile Money', date: '2025-09-12', purpose: 'Tuition — 1st installment', previousBalance: 150_000, remainingBalance: 75_000, cashier: 'Mrs. Biya A.' },
  { reference: 'PAY-2025-0943', studentId: 'STU-002', amount: 150_000, currency: 'XAF', method: 'Cash', date: '2025-09-15', purpose: 'Tuition — full payment', previousBalance: 150_000, remainingBalance: 0, cashier: 'Mr. Tchoupo R.' },
  { reference: 'PAY-2025-1024', studentId: 'STU-005', amount: 25_000, currency: 'XAF', method: 'Bank Transfer', date: '2025-10-03', purpose: 'Examination fees', previousBalance: 90_000, remainingBalance: 65_000, cashier: 'Mrs. Biya A.' },
  { reference: 'PAY-2025-1130', studentId: 'STU-012', amount: 10_000, currency: 'XAF', method: 'Cash', date: '2025-10-21', purpose: 'PTA contribution', previousBalance: 10_000, remainingBalance: 0, cashier: 'Mr. Tchoupo R.' },
  { reference: 'PAY-2026-0042', studentId: 'STU-007', amount: 50_000, currency: 'XAF', method: 'Mobile Money', date: '2026-01-09', purpose: 'Tuition — 2nd installment', previousBalance: 100_000, remainingBalance: 50_000, cashier: 'Mrs. Biya A.' },
]
