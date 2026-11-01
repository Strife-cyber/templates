import { DemoProvider } from './demo/DemoProvider'
import type { DocumentDataProvider } from './types'

const providers = new Map<string, DocumentDataProvider>()

export function registerProvider(provider: DocumentDataProvider): void {
  providers.set(provider.id, provider)
}

export function getProvider(id = 'demo'): DocumentDataProvider {
  const p = providers.get(id)
  if (!p) throw new Error(`No data provider registered as '${id}'`)
  return p
}

export function listProviders(): DocumentDataProvider[] {
  return [...providers.values()]
}

registerProvider(new DemoProvider())
