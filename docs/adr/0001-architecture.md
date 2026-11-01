# ADR-0001: Application architecture

Status: Accepted
Date: 2026-11-01

## Context

Document Studio must keep four concerns independent: template definitions,
data providers, editors, and rendering. A template must be usable with a
different provider tomorrow; a new editor must reuse the same rendering
infrastructure.

## Decision

Single Vite SPA, organised by layer. Direction of dependencies is strict —
lower layers never import from higher ones:

```
persistence/ ─┐
core/ ────────┤   (no React, no DOM assumptions except types)
              v
store/        → zustand slices (selection, history, editor UI state)
editors/      → visual designer, spreadsheet grid
export/       → react-pdf documents, ExcelJS writer, print view
pages/, ui/   → routing, shell, dialogs
```

### Core modules

- `core/schema` — zod schemas. `TemplateDoc` is the single source of truth:
  `schemaVersion`, `kind: 'visual' | 'sheet'`, `page` config, `pages[]`
  (visual) or `sheet` (workbook), `category`, timestamps. `migrateTemplate`
  upgrades older payloads.
- `core/binding` — safe path resolution (`student.fullName`), formatting
  pipes (`date`, `currency`, `number`, `upper`, `lower`, `default`), and a
  visibility-condition evaluator (path + operator + literal). No `eval`.
- `core/providers` — `DocumentDataProvider` interface, a provider registry,
  and `DemoProvider` serving seeded school data (students, classes,
  reports, payments, school profile).
- `core/render` — pure pipeline: `validate → resolve → expand collections
  → paginate`. Produces a `ResolvedDocument` consumed by both the DOM
  preview and the react-pdf exporter.
- `core/sheet` — canonical workbook model (cells with `value | formula |
  binding`, `origin`, style, merges, sizes) and the formula engine wrapper
  over `fast-formula-parser` with a dependency graph and cycle detection.

### Persistence

`TemplateRepository` interface; Dexie-backed implementation for IndexedDB
plus an in-memory implementation for unit tests. Templates export/import as
versioned JSON.

### State

Zustand stores, one per editor surface, plus a template store for CRUD.
Undo/redo is a command-based history living in each editor store (coalesced
for continuous gestures like drag and text typing). Editor state (selection,
zoom, clipboard) is never persisted inside the template.

## Consequences

- Tests can exercise schema, bindings, render and formulas in pure
  TypeScript — no DOM required.
- Swapping `DemoProvider` for an API provider touches only the registry.
- A third editor type plugs into `kind` on `TemplateDoc` plus the render
  pipeline without changing persistence or providers.
