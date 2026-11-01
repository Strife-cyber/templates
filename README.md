# Document Studio

A local-first, data-driven document design & generation platform. Design reusable
templates once, bind them to provider-supplied data, and produce real PDF and
XLSX documents — no backend, no accounts, everything lives in your browser
(IndexedDB).

Two editor kinds:

- **Visual editor** — a freeform canvas (Canva-style) for designed documents:
  receipts, report cards, certificates. Elements: text, rich text, image,
  rectangle, line, divider, **repeating table**, QR code, page number.
- **Spreadsheet editor** — an Excel-style grid for tabular documents: mark
  sheets, class PVs. Cells support manual values, formulas (`=AVERAGE(...)`,
  `=IF(...)`, ranges) and **bound rows** populated from a data collection.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

On first launch three sample templates are seeded (Payment Receipt, Report
Card, Class PV). Open one, pick a scenario in the **Preview data** bar, and the
bindings resolve live against the bundled demo dataset (a bilingual college
with 26 students and full term results).

```bash
npm test           # unit tests (vitest)
npx playwright test # end-to-end DoD scenarios; also writes sample PDFs/XLSX
                    # to samples/output/
npm run build      # type-check + production build
```

## How it works

```
template (JSON, versioned schema)
   │  bindings like  student.fullName · academicReport.subjects[].score
   ▼
resolveVisualDocument(template, context) ──► ResolvedDocument
   │                                          (pure: text, tables, pagination)
   ▼
canvas / preview / PDF export / print
```

Templates are framework-independent JSON documents (`schemaVersion` +
migrations). The same resolved document drives the editor canvas, the preview
modal, PDF export (`@react-pdf/renderer`) and browser printing — the renderer
never touches editor state.

Data comes from **providers** behind an interface (`listScenarios /
listRecords / resolve / sampleContext`). A `DemoProvider` ships realistic seed
data; a production provider (e.g. a school API) can be registered in
`src/core/providers/registry.ts` without touching the editors.

## Layout

```
src/
  core/            framework-free engine: schema, bindings, resolution, formulas
    schema/        template JSON schema (zod), factories, migrations
    binding/       path parsing, formatting (date/currency/number), conditions
    render/        template → resolved document (data + pagination)
    sheet/         cell model, formula evaluation (fast-formula-parser)
    providers/     data provider interface + demo school dataset
  editors/
    visual/        canvas, palette, inspector, drag-drop, guides
    sheet/         grid, toolbar, formula bar, row-source + print modals
  store/           zustand editor stores (history, autosave, context)
  export/          PDF (visual + sheet) and XLSX exporters
  persistence/     IndexedDB repository (dexie), import/export, sample seeding
tests/
  unit/            36 unit tests (bindings, resolution, pagination, formulas)
  e2e/             Playwright DoD scenarios A–C, emit samples/output/*
docs/
  adr/             requirements review + architecture decisions
  template-schema.md, data-providers.md, known-limitations.md
samples/output/    example generated PDFs/XLSX (regenerate via playwright)
```

## Documentation

- [Template JSON schema](docs/template-schema.md)
- [Data providers](docs/data-providers.md)
- [ADRs](docs/adr/) — requirements review, architecture, PDF and spreadsheet choices
- [Known limitations & next steps](docs/known-limitations.md)
