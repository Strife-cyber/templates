import { clsx } from '../utils/clsx'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

export function Button(
  props: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'ghost' | 'outline' | 'danger'
    size?: 'sm' | 'md'
  },
) {
  const { variant = 'ghost', size = 'md', className, ...rest } = props
  return (
    <button
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors select-none',
        'disabled:opacity-40 disabled:pointer-events-none',
        size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-[13px]',
        variant === 'primary' && 'bg-accent text-white hover:bg-accent-2',
        variant === 'ghost' && 'text-ink-2 hover:bg-black/5 hover:text-ink',
        variant === 'outline' && 'border border-line-2 bg-panel text-ink-2 hover:bg-black/3',
        variant === 'danger' && 'text-danger hover:bg-red-50',
        className,
      )}
      {...rest}
    />
  )
}

export function IconButton(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean },
) {
  const { label, active, className, children, ...rest } = props
  return (
    <button
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={clsx(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 transition-colors',
        'hover:bg-black/5 hover:text-ink disabled:opacity-40',
        active && 'bg-accent-soft text-accent-2',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        'h-8 w-full rounded-md border border-line-2 bg-panel px-2 text-[13px] text-ink',
        'placeholder:text-ink-3/60 outline-none focus:border-accent focus:ring-2 focus:ring-accent/15',
        props.className,
      )}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        'h-8 rounded-md border border-line-2 bg-panel px-2 text-[13px] text-ink',
        'outline-none focus:border-accent focus:ring-2 focus:ring-accent/15',
        props.className,
      )}
    />
  )
}

export function Field(props: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-3">{props.label}</span>
      {props.children}
      {props.hint && <span className="mt-1 block text-[11px] text-ink-3/80">{props.hint}</span>}
    </label>
  )
}

export function Badge(props: { children: ReactNode; tone?: 'default' | 'accent' | 'warn' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        props.tone === 'accent' && 'bg-accent-soft text-accent-2',
        props.tone === 'warn' && 'bg-amber-100 text-amber-800',
        (!props.tone || props.tone === 'default') && 'bg-black/5 text-ink-3',
      )}
    >
      {props.children}
    </span>
  )
}

export function EmptyState(props: {
  icon?: ReactNode
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      {props.icon && <div className="text-ink-3/60">{props.icon}</div>}
      <div className="text-sm font-medium text-ink-2">{props.title}</div>
      {props.body && <div className="max-w-80 text-xs text-ink-3">{props.body}</div>}
      {props.action && <div className="mt-2">{props.action}</div>}
    </div>
  )
}
