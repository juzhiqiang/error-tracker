import { ErrorTrackerClient } from './core/client'
import { NodeErrorsIntegration } from './integrations/node-errors'
import type { SdkOptions } from './types'

export { ErrorTrackerClient } from './core/client'
export type { SdkOptions, Integration, ErrorEvent } from './types'

let _client: ErrorTrackerClient | null = null

export function init(options: SdkOptions): ErrorTrackerClient {
  _client = new ErrorTrackerClient({
    integrations: [new NodeErrorsIntegration()],
    ...options,
  })
  _client.setupIntegrations()
  return _client
}

export function captureException(error: Error): void {
  _client?.captureException(error)
}

export function captureMessage(message: string): void {
  _client?.captureMessage(message)
}
