import { X } from 'lucide-react'
import { useState } from 'react'
import type { ResolvedDocument } from '../../core/render/types'
import { ElementContent, MM_TO_PX } from './ElementContent'
import { IconButton } from '../../ui/controls'

/** Full-page preview of the resolved document (bindings applied, paginated). */
export function PreviewModal({ resolved, onClose }: { resolved: ResolvedDocument; onClose: () => void }) {
  const [zoom, setZoom] = useState(0.9)
  const scale = MM_TO_PX * zoom

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40">
      <div className="flex h-11 items-center justify-between bg-panel px-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">Preview</span>
          <span className="text-xs text-ink-3">
            {resolved.pageCount} page{resolved.pageCount === 1 ? '' : 's'} · {resolved.widthMm}×{resolved.heightMm} mm
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.4}
            max={1.6}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-28"
          />
          <span className="w-9 text-right text-xs text-ink-3">{Math.round(zoom * 100)}%</span>
          <IconButton label="Close preview" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="flex flex-col items-center gap-6 p-8">
          {resolved.pages.map((page, i) => (
            <div
              key={page.id}
              className="relative shrink-0 bg-white shadow-[0_2px_20px_rgba(0,0,0,0.25)]"
              style={{ width: resolved.widthMm * scale, height: resolved.heightMm * scale }}
            >
              <div
                className="absolute"
                style={{
                  left: resolved.margins.left * scale,
                  top: resolved.margins.top * scale,
                  width: (resolved.widthMm - resolved.margins.left - resolved.margins.right) * scale,
                  height: (resolved.heightMm - resolved.margins.top - resolved.margins.bottom) * scale,
                }}
              >
                {page.elements.map((el) => (
                  <div
                    key={el.id}
                    className="absolute"
                    style={{
                      left: el.x * scale,
                      top: el.y * scale,
                      width: el.w * scale,
                      height: el.h * scale,
                      transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                    }}
                  >
                    <ElementContent el={el} />
                  </div>
                ))}
              </div>
              <div className="absolute -bottom-5 left-0 text-[11px] text-white/70">Page {i + 1}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
