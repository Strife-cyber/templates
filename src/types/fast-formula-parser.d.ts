declare module 'fast-formula-parser' {
  export interface DepRef {
    row: number
    col: number
    sheet?: string
  }
  export interface Dep {
    row: number
    col: number
    sheet?: string
    from: DepRef
    to: DepRef
  }
  export interface ParserOptions {
    onCell?: (ref: DepRef) => unknown
    onRange?: (ref: { from: DepRef; to: DepRef }) => unknown
    onUndefinedFunction?: (name: string, payload?: unknown) => unknown
  }
  export default class FormulaParser {
    constructor(options?: ParserOptions)
    parse(formula: string, position?: { row: number; col: number }): unknown
  }
}

declare module 'fast-formula-parser/grammar/dependency/hooks' {
  export interface Dep {
    row: number
    col: number
    sheet?: string
    from: { row: number; col: number; sheet?: string }
    to: { row: number; col: number; sheet?: string }
  }
}
