import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { IconButton } from './controls'

export function Modal(props: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: number
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (props.open && !el.open) el.showModal()
    if (!props.open && el.open) el.close()
  }, [props.open])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onCancel = (e: Event) => {
      e.preventDefault()
      props.onClose()
    }
    const onClick = (e: MouseEvent) => {
      if (e.target === el) props.onClose()
    }
    el.addEventListener('cancel', onCancel)
    el.addEventListener('click', onClick)
    return () => {
      el.removeEventListener('cancel', onCancel)
      el.removeEventListener('click', onClick)
    }
  }, [props])

  return (
    <dialog
      ref={ref}
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-panel p-0 shadow-2xl backdrop:bg-black/30"
      style={{ width: props.width ?? 480 }}
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">{props.title}</h2>
        <IconButton label="Close" onClick={props.onClose}>
          <X size={15} />
        </IconButton>
      </div>
      <div className="p-4">{props.children}</div>
    </dialog>
  )
}
