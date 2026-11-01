# Known limitations & next steps

## Limitations (by design / out of POC scope)

- **Single user, single browser.** IndexedDB storage; no sync, sharing or
  versioning of template history (schema versioning exists, not document
  history).
- **Table pagination is whole-row.** A row taller than the remaining space
  moves to the next page; very long cell text is clipped, never split.
- **Sheet PDF is a fixed-cell snapshot** rendered through the same exporter —
  cell text that overflows its column is not wrapped into neighbouring cells
  the way Excel does. Long text may be visually truncated.
- **Formula set is the fast-formula-parser catalog** — no named ranges, no
  cross-sheet refs, no volatile functions. Cycles report `#CYCLE!` rather than
  being tolerated.
- **Rich text is a fixed subset** (bold/italic/underline/align/lists/headings)
  sanitized by the editor — enough for document styling, not full HTML.
- **Print uses the browser dialog**; page breaks follow the sheet print config,
  but header/footer chrome is the browser's.
- **Import/export is whole-template JSON** — no partial merge, no conflict
  resolution on re-import (re-import of the same id overwrites).
- **No undo across page reload**; in-session history is capped at 100 entries.
- **Image elements embed data-URL/remote URLs as-is** — no upload pipeline or
  optimization.

## Deliberate trade-offs (see ADRs)

- React-PDF renderer instead of pixel-perfect canvas rasterization → real
  vector PDFs with selectable text, at the cost of occasional minor visual
  differences from the canvas.
- Sheet grid renders only the used region rather than a virtualized infinite
  grid → simpler code; the grid is capped at 80×12 by default.
- DemoProvider ships one realistic dataset rather than a mock generator →
  credible DoD demos; a second provider proves the abstraction.

## Suggested next steps (prioritized)

1. **User-managed data sources**: a providers settings page to register an
   HTTP/GraphQL endpoint + a context-shape inspector.
2. **Template library & duplication/renaming polish**, tags/search.
3. **Table header repetition** on continuation pages (already supported in the
   resolver — expose the toggle in the inspector).
4. **Rich-text and textStyle parity** between canvas and PDF (font embedding
   for non-Latin scripts).
5. **Sheet UX**: selection dragging, fill handle, column-resize handles,
   insert/delete row ops that remap `rowSource.startRow` safely.
6. **Batch generation**: pick a scenario + "all records" → zip of PDFs / one
   multi-sheet XLSX.
7. **CI** for vitest + playwright; publish `samples/output` as artifacts.
8. **Larger scope**: cooperative editing via CRDT, template inheritance,
   conditional formatting, chart elements.
