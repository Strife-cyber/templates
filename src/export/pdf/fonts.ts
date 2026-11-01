import { Font } from '@react-pdf/renderer'
import inter400 from '@fontsource/inter/files/inter-latin-400-normal.woff?url'
import inter500 from '@fontsource/inter/files/inter-latin-500-normal.woff?url'
import inter600 from '@fontsource/inter/files/inter-latin-600-normal.woff?url'
import inter700 from '@fontsource/inter/files/inter-latin-700-normal.woff?url'
import inter400i from '@fontsource/inter/files/inter-latin-400-italic.woff?url'

let registered = false

/** Map UI font choices onto registered families (approximations for PDF). */
const FAMILY_MAP: Record<string, string> = {
  Inter: 'Inter',
  Arial: 'Inter',
  Verdana: 'Inter',
  Georgia: 'Times-Roman',
  'Times New Roman': 'Times-Roman',
  'Courier New': 'Courier',
}

export function registerPdfFonts(): void {
  if (registered) return
  registered = true
  try {
    Font.register({
      family: 'Inter',
      fonts: [
        { src: inter400, fontWeight: 400, fontStyle: 'normal' },
        { src: inter400i, fontWeight: 400, fontStyle: 'italic' },
        { src: inter500, fontWeight: 500, fontStyle: 'normal' },
        { src: inter600, fontWeight: 600, fontStyle: 'normal' },
        { src: inter700, fontWeight: 700, fontStyle: 'normal' },
      ],
    })
    Font.registerHyphenationCallback((word) => [word])
  } catch {
    // Built-in families still work if registration fails.
  }
}

export function pdfFontFamily(uiFamily: string): string {
  return FAMILY_MAP[uiFamily] ?? 'Inter'
}
