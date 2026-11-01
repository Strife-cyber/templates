import { Text } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import type { ReactNode } from 'react'

/**
 * Convert sanitized rich-text HTML to react-pdf <Text> spans.
 * Handles the same small tag set the sanitizer allows.
 */
export function htmlToPdfNodes(html: string, baseStyle: Style): ReactNode[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: ReactNode[] = []
  let key = 0

  const walk = (node: ChildNode, style: Style) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ''
      if (text) out.push(<Text key={key++} style={style}>{text}</Text>)
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    const next: Style = { ...style }
    if (tag === 'b' || tag === 'strong') next.fontWeight = 'bold'
    if (tag === 'i' || tag === 'em') next.fontStyle = 'italic'
    if (tag === 'u') next.textDecoration = 'underline'
    if (tag === 's') next.textDecoration = 'line-through'
    if (tag === 'br') {
      out.push(<Text key={key++}>{'\n'}</Text>)
      return
    }
    if (tag === 'p' || tag === 'li') {
      if (tag === 'li') out.push(<Text key={key++}>•  </Text>)
      el.childNodes.forEach((c) => walk(c, next))
      out.push(<Text key={key++}>{'\n'}</Text>)
      return
    }
    if (tag === 'ul' || tag === 'ol') {
      el.childNodes.forEach((c) => walk(c, next))
      return
    }
    el.childNodes.forEach((c) => walk(c, next))
  }

  doc.body.childNodes.forEach((c) => walk(c, baseStyle))
  return out
}
