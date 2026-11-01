export type ClassValue = string | false | null | undefined

export function clsx(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(' ')
}
