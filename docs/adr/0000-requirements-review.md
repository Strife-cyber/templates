# ADR-0000: Requirements Review

Status: Accepted — written before Stage 1, per spec §13b.
Date: 2026-11-01

This document is the required critical review of the Document Studio POC
specification. Each challenge is classified:

- **Minor** — decided, recorded here, work continued.
- **Significant** — recommended option implemented, trade-off recorded.
- **Blocking** — would need the requester; none was found.

---

## 1. Contradictions and ambiguities, and how they are resolved

### 1.1 PDF "prefer Chromium" vs "do not introduce a backend" — **Significant**

The spec asks to "prefer a reliable HTML/CSS-to-PDF solution using Chromium"
and simultaneously forbids a backend. A headless-Chromium renderer
(Puppeteer/Playwright) is a server-side dependency; running it inside the
shipped app is impossible in a purely local-first SPA.

**Resolution:** two-track export.

- In-app export uses `@react-pdf/renderer` (MIT). It consumes the same
  resolved view-model as the DOM preview renderer, produces genuine PDF
  documents with selectable/searchable text, vector output, correct page
  boxes, page numbers, headers/footers — and downloads a real file.
- Browser print (`window.print` on a print-specific view with `@page`
  rules) is offered as a secondary path for users who want Chromium's own
  rendering.
- Playwright (already in the test stack) generates the *sample* PDFs
  committed under `samples/output/` via a dev script — that covers the
  "Chromium" preference where it is actually appropriate: engineering-time
  artifacts, not runtime.

**Trade-off:** the DOM preview and the PDF export are two renderers driven
by one resolved view-model rather than literally the same pixel pipeline.
Mitigation: the visual designer uses absolute positioning (mm units), so
layout is deterministic and both renderers consume identical geometry;
consistency is verified by tests and eyeball-checkable in Preview.

### 1.2 Spreadsheet implementation is unspecified — **Significant**

The spec suggests Univer "subject to licensing and integration assessment."
Assessment: Univer's open-source core is Apache-2.0, but XLSX import/export
is delivered through "file conversion," which is part of the *commercial*
Office SDK — a Definition-of-Done requirement (Scenario C.10) would depend
on a paid component. Univer also persists its own workbook model, which
conflicts with the mandatory requirement that template definitions be
framework-independent JSON.

**Resolution:** build a focused spreadsheet grid over our own canonical
cell model, with `fast-formula-parser` (MIT, ~280 functions, LL(1) parser,
no `eval`) for the formula engine and `exceljs` (MIT) for XLSX export.
This is the spec-sanctioned "or build" path. It is **not** "a simple HTML
table": the grid implements headers, cell/range selection, keyboard
navigation, clipboard, row/column insert-delete-resize, formatting, merged
cells, frozen panes, and undo/redo.

**Trade-off:** no commercial-grade surface (no charts, sparklines,
thousands of functions). Accepted: the DoD requires a bounded feature set,
and owning the model is what makes per-cell data-origin tracking (manual /
source-bound / calculated / overridden) and faithful JSON round-tripping
possible at all.

### 1.3 Single page vs multi-page documents — **Minor**

The spec describes one canvas page but also requires multi-page output and
page numbers. **Resolution:** a template is an ordered list of pages; each
page carries its own element list. Repeating tables that overflow a page
continue onto generated continuation pages during rendering. A `pageNumber`
element resolves per rendered page (`n / total`).

### 1.4 "Change a student's grade" vs "don't overwrite source-bound values" — **Minor**

Scenario C asks the user to edit a bound value and see formulas
recalculate. **Resolution:** cell-origin tracking. Source-populated cells
are marked `source`; a user edit flips the cell to `overridden` (kept,
visually flagged, never silently re-overwritten until an explicit "refresh
data" action). Formulas always recompute over the current values.

### 1.5 "Rich text" element — **Minor**

Scope is unbounded in the spec. **Resolution:** a constrained rich-text
subset (bold, italic, underline, lists, alignment, links) via TipTap, with
the persisted HTML sanitized through DOMPurify on save and on render.
No arbitrary HTML/script execution.

### 1.6 Coordinate units — **Minor**

The example uses pixels; print documents need physical units.
**Resolution:** element geometry is stored in millimetres (page sizes are
physical: A4 210×297). Screen rendering scales by zoom; print/PDF use the
mm values directly, so WYSIWYG is exact rather than approximate.

### 1.7 Autosave — **Minor**

**Resolution:** debounced autosave (~1 s after the last change) into
IndexedDB with a visible saved/dirty indicator; `beforeunload` guard while
a save is pending.

### 1.8 Categories vs freedom — **Minor**

"The selected document category must not unnecessarily restrict what users
can design." Resolution: category is a filter/tag on the template, never a
capability gate. All element types and all data sources are available in
every template.

### 1.9 Multi-selection "if practical" — **Minor**

Implemented as shift-click additive selection plus marquee selection on
empty canvas, with group move and delete. Alignment/distribution of
multi-selection is omitted (recorded as a limitation, not DoD).

---

## 2. Requirements judged wrong, risky or overscoped

| Requirement | Problem | Decision |
|---|---|---|
| Univer as the spreadsheet (suggestion) | XLSX export is commercial; own workbook model conflicts with framework-free template JSON; heavy bundle. | Custom grid + `fast-formula-parser` + `exceljs` (see §1.2). |
| Screenshot-based PDF | Explicitly banned by the spec itself; some "easy" paths (`html2canvas`, `html2pdf.js`) do exactly this. | Not used anywhere; PDF is vector text via react-pdf. |
| Full Canva/Figma parity ("multi-selection", "alignment guides", "rotation") | Unbounded editor scope would crowd out the actual DoD. | Full set in the spec's list is implemented; advanced extras (distribution, arbitrary rotation UI) limited to supported scope: rotation property exists in the schema and is applied, but there is no rotate handle in the POC. |
| Freeze panes "if practical" | Practical: sticky top rows / left columns in the grid viewport. Implemented. | Kept. |
| Charts/images inside spreadsheet | Never requested; skip explicitly to avoid scope creep. | Out of scope. |

## 3. Requirements that are well-founded and preserved

- **Versioned, framework-free template JSON** — the single most important
  architectural property; enforced with a zod-validated `schemaVersion`
  field and a migration hook.
- **Provider abstraction** — real integration later without touching the
  editors; enforced by TypeScript interfaces and a registry.
- **Renderer independent of editor UI state** — the render pipeline is a
  pure function `template + data context → resolved document`.
- **No `eval`, safe formulas, restricted binding paths** — binding paths
  resolve only against declared source schemas; formulas parse through a
  grammar, never `eval`.
- **IndexedDB local-first persistence** — right call for a POC; repository
  lives behind an interface so a backend can replace it.
- **Bindings stay symbolic** — persisted as `{ path, format, fallback }`,
  resolved at render time; switching preview record re-resolves, never
  rewrites the template.

## 4. Improvements not requested, adopted anyway

1. **Schema migrations** — `schemaVersion` + a `migrateTemplate(json)`
   step on import/open so future schema changes don't break saved work.
2. **Shipped sample templates** — a receipt, a report card and a class PV
   installable from the landing page, so every DoD scenario is one click
   away for a reviewer.
3. **Cell-origin legend** — visual tinting + legend for manual / bound /
   formula / overridden cells (spec asks for "a clear visual indication";
   the legend makes it self-explanatory).
4. **Print-preflight warnings** — non-blocking warnings (e.g. element
   bleeding past the printable area) surfacing in the inspector.
5. **Committed example PDFs** — generated by a Playwright script into
   `samples/output/`, satisfying deliverable #10 reproducibly.

## 5. Blocking items

None. Every ambiguity had a viable in-scope resolution; nothing in the
spec conflicts with the Definition of Done once §1.1 and §1.2 are resolved
as above.
