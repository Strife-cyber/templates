/**
 * Data provider abstraction.
 *
 * Editors never touch provider internals: a provider exposes *scenarios*
 * (document/data shapes such as "payment receipt" or "class report"), each
 * with selectable records. Resolving a scenario+record yields a plain
 * `DocumentDataContext` object that bindings resolve against.
 *
 * A real school system replaces `DemoProvider` with an API-backed provider
 * implementing the same interface — no editor or renderer changes required.
 */

export type DocumentDataContext = Record<string, unknown>

export interface ScenarioInfo {
  id: string
  label: string
  description: string
  /** Top-level keys a resolved context will contain. */
  contextKeys: string[]
}

export interface RecordRef {
  id: string
  label: string
  /** Secondary text shown in pickers (e.g. "Form 5A · 2025/2026"). */
  detail?: string
}

export interface DocumentDataProvider {
  readonly id: string
  readonly label: string
  listScenarios(): Promise<ScenarioInfo[]>
  listRecords(scenarioId: string): Promise<RecordRef[]>
  /** Resolve a full binding context for one record. */
  resolve(scenarioId: string, recordId: string): Promise<DocumentDataContext>
  /**
   * A representative context for binding pickers, independent of which record
   * is currently selected. Defaults to the first record.
   */
  sampleContext(scenarioId: string): Promise<DocumentDataContext>
}
