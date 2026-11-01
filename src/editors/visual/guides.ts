/**
 * Alignment guides and snapping for the canvas.
 * All geometry is in millimetres relative to the page content box.
 */

export interface Guide {
  axis: 'x' | 'y'
  pos: number // mm
}

export interface SnapResult {
  dx: number
  dy: number
  guides: Guide[]
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const THRESHOLD = 1.2 // mm

function edges(r: Rect): { xs: number[]; ys: number[] } {
  return { xs: [r.x, r.x + r.w / 2, r.x + r.w], ys: [r.y, r.y + r.h / 2, r.y + r.h] }
}

/**
 * Snap a moving rect to the page centre lines and to the edges/centres of
 * other elements. Returns the delta to apply and the guides to draw.
 */
export function snapRect(
  moving: Rect,
  others: Rect[],
  page: { w: number; h: number },
  enabled: boolean,
): SnapResult {
  if (!enabled) return { dx: 0, dy: 0, guides: [] }

  const m = edges(moving)
  const statics: { xs: number[]; ys: number[] } = {
    xs: [0, page.w / 2, page.w],
    ys: [0, page.h / 2, page.h],
  }
  for (const o of others) {
    const e = edges(o)
    statics.xs.push(...e.xs)
    statics.ys.push(...e.ys)
  }

  let bestX: { d: number; guide: number } | null = null
  for (const target of statics.xs) {
    for (const edge of m.xs) {
      const d = target - edge
      if (Math.abs(d) <= THRESHOLD && (!bestX || Math.abs(d) < Math.abs(bestX.d))) {
        bestX = { d, guide: target }
      }
    }
  }
  let bestY: { d: number; guide: number } | null = null
  for (const target of statics.ys) {
    for (const edge of m.ys) {
      const d = target - edge
      if (Math.abs(d) <= THRESHOLD && (!bestY || Math.abs(d) < Math.abs(bestY.d))) {
        bestY = { d, guide: target }
      }
    }
  }

  const guides: Guide[] = []
  if (bestX) guides.push({ axis: 'x', pos: bestX.guide })
  if (bestY) guides.push({ axis: 'y', pos: bestY.guide })
  return { dx: bestX?.d ?? 0, dy: bestY?.d ?? 0, guides }
}

export const roundMm = (n: number, step = 0.5) => Math.round(n / step) * step
