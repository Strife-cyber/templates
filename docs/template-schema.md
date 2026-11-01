# Template JSON schema

Templates are plain JSON (versioned via `schemaVersion`, migrated on load by
`src/core/schema/migrations.ts`). The zod schema is the source of truth:
`src/core/schema/template.ts`. Export via *Export JSON* on the template card;
imports are validated before being stored.

## Top level — `TemplateDoc`

| field | type | notes |
|---|---|---|
| `schemaVersion` | number | currently `1` |
| `id` | `tpl_…` string | unique |
| `name`, `description` | string | |
| `category` | `'academic' \| 'financial' \| 'administrative' \| 'other'` | |
| `kind` | `'visual' \| 'sheet'` | picks the editor |
| `page` | `PageConfig` | size, orientation, margins — shared by PDF/print |
| `pages` | `VisualPage[]` | visual templates only |
| `sheet` | `SheetDoc` | sheet templates only |
| `createdAt`, `updatedAt` | ISO string | |

`PageConfig` = `{ size: 'A4'|'A3'|'custom', orientation, widthMm, heightMm, margins: {top,right,bottom,left} }` (all mm).

## Visual templates — `VisualPage.elements[]`

Every element has geometry in **mm** (origin = page content box, i.e. inside
the margins), `rotation`, `z`, `id`, `type`, `props`, plus optional `binding`,
`visibleWhen`, `textStyle`, `boxStyle`.

Types: `text`, `richText` (sanitized HTML), `image`, `rect`, `line`,
`divider`, `qr`, `pageNumber`, `table`.

### Bindings

```json
"binding": {
  "path": "student.fullName",
  "format": { "type": "date", "pattern": "DD/MM/YYYY" },
  "fallback": "—"
}
```

`format` is one of `{type:'date',pattern}` / `{type:'currency',currency}` /
`{type:'number',decimals}` / `{type:'upper'}` / `{type:'lower'}` / `{type:'title'}`.

Paths are dot-separated; array items are `collection[].field`. Path segments
must match `[A-Za-z_$][A-Za-z0-9_$]*` — `__proto__`/`constructor`/`prototype`
are rejected (no prototype traversal).

### `visibleWhen`

```json
"visibleWhen": { "path": "payment.remainingBalance", "op": "gt", "value": 0 }
```

Ops: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `truthy`, `empty`.

### `table` props

```json
"props": {
  "columns": [{ "id": "c1", "header": "Subject", "widthMm": 62,
               "align": "left",
               "binding": { "path": "academicReport.subjects[].subject" } }],
  "rows": { "path": "academicReport.subjects[]" },
  "rowHeightMm": 8, "headerHeightMm": 9,
  "zebra": false, "showHeader": true
}
```

The table repeats one row per item of the collection named by `rows.path`.
Column bindings may be written `collection[].field` or relative `field`. Rows
that overflow the page are paginated onto continuation pages; elements below
the table are pushed to its last continuation page.

## Sheet templates — `SheetDoc`

```json
"sheet": {
  "rowCount": 80, "colCount": 12,
  "cells": { "A1": { "v": "Name", "origin": "manual", "style": {…} } },
  "colWidths": { "1": 110 }, "rowHeights": { "2": 24 },
  "merges": ["A1:E1"], "frozenRows": 1, "frozenCols": 1,
  "rowSource": { "source": "demo", "collectionPath": "students[]",
                 "startRow": 2, "mapping": { "A": "student.fullName" } },
  "print": { "size": "A4", "orientation": "landscape",
             "area": null, "repeatHeaderRows": 1 }
}
```

- Cell keys are A1 addresses. A cell is `{ v }`, `{ f }` (formula, without
  `=`), or both (`f` + cached `v`), plus `origin` and optional `b` (binding
  provenance) / `style`.
- `origin`: `manual | source | formula | overridden`. `source` cells come from
  `rowSource.mapping` (`column letter → item-relative path`); editing one
  converts it to `overridden` so re-applying the source never clobbers user
  edits. Tints: source=green, formula=violet, overridden=amber.
- `merges` are A1 ranges; top-left cell owns content.
- `colWidths`/`rowHeights` are keyed by **numeric index** (`"1"`, not `"A"`).
- `print.area` is an A1 range or `null` (used range); `repeatHeaderRows`
  repeats the first N rows of the printed range on each page. Margins and
  paper size fall back to `template.page`.

### Formulas

`fast-formula-parser` — `SUM`, `AVERAGE`, `COUNT`, `IF`, `ROUND`, arithmetic,
ranges (`B2:G25`) and cell refs. Cycles resolve to `#CYCLE!`, unknown
functions to `#NAME?`-style errors; evaluation is dependency-ordered.
