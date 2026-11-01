# ADR-0003: Spreadsheet implementation

Status: Accepted
Date: 2026-11-01

## Context

The spec suggests Univer "subject to licensing and integration assessment,"
and forbids "a simple HTML table" posing as a spreadsheet. Scenario C
requires formulas, dynamic row binding, cell-origin visibility and XLSX
export.

## Assessment of Univer

- Core is Apache-2.0 — acceptable.
- **XLSX import/export is a commercial "file conversion" feature** — a DoD
  requirement would need a paid module.
- Univer persists its own workbook model; the spec mandates
  framework-independent template JSON, forcing a lossy two-way translation.
- Integration surface is large for the bounded POC feature set.

## Decision

Build a focused spreadsheet grid over the canonical `core/sheet` model:

- Real spreadsheet behaviours: row/column headers, cell and range
  selection, keyboard navigation, in-cell editing, clipboard copy/paste,
  row/column insert-delete-resize, merges, frozen panes (sticky viewport),
  formatting toolbar, undo/redo.
- `fast-formula-parser` (MIT) evaluates formulas — a grammar parser, not
  `eval`. Dependency graph recalculates dependents and detects circular
  references (`#CYCLE!` / `#ERR!` surfaced in-cell).
- `exceljs` (MIT) writes XLSX including formulas.
- Cell `origin: manual | source | formula | overridden` powers the required
  visual indication and the "don't silently overwrite" rule.

## Consequences

- The workbook model is our own JSON — free round-trip through templates.
- Deliberately bounded: no charts, no named ranges, no thousands of
  functions (280+ available though). Documented in known limitations.
