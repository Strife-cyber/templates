# ADR-0002: PDF and print rendering

Status: Accepted
Date: 2026-11-01

## Context

The spec prefers Chromium HTML/CSS→PDF but forbids a backend, bans
screenshot-based output, and requires selectable text and
preview/export consistency.

## Options considered

1. **Headless Chromium (Puppeteer/Playwright) at runtime** — rejected:
   requires a backend/external service.
2. **`html2canvas`/`html2pdf.js`** — rejected: rasterises the DOM
   (screenshot output), explicitly banned.
3. **`pdfmake`/`jsPDF` direct drawing** — rejected: a second hand-written
   layout engine with weak text/layout fidelity for tables.
4. **`@react-pdf/renderer`** — chosen: real vector PDF, absolute
   positioning, multi-page, headers/footers, selectable text, file download.
5. **Browser print pipeline** — kept as secondary path: a print-only view
   with `@page` CSS; Chromium itself renders the PDF via "Save as PDF".

## Decision

`@react-pdf/renderer` for in-app file export; browser print for the
Chromium path. Both consume the same `ResolvedDocument` produced by
`core/render`. Since the designer is absolute-positioned in millimetres,
the two renderers receive identical geometry, keeping preview and export
consistent. Playwright generates the committed sample PDFs under
`samples/output/` (engineering-time Chromium rendering).

Fonts are registered from bundled `@fontsource` assets in the PDF renderer
so output is deterministic across machines.

## Consequences

- No runtime server dependency.
- Export fidelity depends on both renderers consuming the resolved
  view-model correctly; covered by unit tests on the pipeline plus manual
  verification (and limitations documented in `docs/known-limitations.md`).
