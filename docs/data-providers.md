# Data providers

All data flows through one narrow interface — `src/core/providers/types.ts`:

```ts
interface DataProvider {
  readonly id: string
  listScenarios(): Promise<ScenarioInfo[]>          // e.g. "payment-receipt"
  listRecords(scenarioId: string): Promise<RecordRef[]>   // e.g. STU-001 …
  resolve(scenarioId: string, recordId: string): Promise<DocumentDataContext>
  sampleContext(scenarioId: string): Promise<DocumentDataContext>
}
```

`DocumentDataContext` is a plain JSON object tree — `{ school, student,
payment, academicReport, students, … }` — the only thing bindings may read.
Editors and exporters never fetch data directly; the resolution layer
(`src/core/render/resolve.ts`) is pure and idempotent, so the canvas, preview,
PDF and XLSX always see identical values.

## DemoProvider

`src/core/providers/demo/` ships a realistic bilingual-college dataset:

| scenario | context keys |
|---|---|
| `payment-receipt` | `school`, `student`, `payment` (reference, amount, currency, method, date, purpose, previousBalance, remainingBalance, cashier), `receipt` (issuedAt, number) |
| `report-card` | `school`, `student`, `academicReport` (term, academicYear, class, classTeacher, subjects[] {subject, score, coefficient, rank, remark}, generalAverage, rank, classAverage, teacherRemark, decision) |
| `class-pv` | `school`, `klass`, `students[]` {student, results{Subject:score}, average, rank, decision} |
| `student-profile` | `school`, `student` |
| `class-register` | `school`, `klass`, `students[]` |

26 students, 9 subjects, averages/ranks/decisions precomputed. `resolve` with
an unknown or empty `scenarioId` falls back to `{ school }` — so a template
always renders *something*.

## Adding a real provider

1. Implement `DataProvider` (e.g. `HttpProvider` fetching your API, mapping
   responses to the same context shape).
2. Register it in `src/core/providers/registry.ts`:

```ts
setProvider(new HttpProvider({ baseUrl: '/api' }))
```

That's it — the **Preview data** bar, sheet row-source dropdown and every
exporter pick it up automatically. Key point: the provider owns both the
*shape of the context* and *which scenarios exist*; templates only declare
paths against that shape.

Binding fields are always read from the declared provider output — there is
no eval, no arbitrary code in bindings, and path segments are validated to
block prototype traversal.
