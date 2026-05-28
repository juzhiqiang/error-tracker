import { ErrorTrackerClient } from './core/client'
import { BrowserErrorsIntegration } from './integrations/browser-errors'
import { BrowserBreadcrumbsIntegration } from './integrations/browser-breadcrumbs'
import { BrowserPerformanceIntegration } from './integrations/browser-performance'
import type { SdkOptions } from './types'

export { ErrorBoundary } from './integrations/react-error-boundary'
export { ErrorTrackerClient } from './core/client'
export type { SdkOptions, Integration, ErrorEvent, Breadcrumb } from './types'

let _client: ErrorTrackerClient | null = null

export function init(options: SdkOptions): ErrorTrackerClient {
  const defaultIntegrations = [
    new BrowserErrorsIntegration(),
    new BrowserBreadcrumbsIntegration(),
    new BrowserPerformanceIntegration(),
  ]
  _client = new ErrorTrackerClient({
    ...options,
    integrations: [...defaultIntegrations, ...(options.integrations ?? [])],
  })
  _client.setupIntegrations()

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      _client?.flush(true)
    }
  })

  return _client
}

export function captureException(error: Error): void {
  _client?.captureException(error)
}

export function captureMessage(message: string): void {
  _client?.captureMessage(message)
}

export function getClient(): ErrorTrackerClient | null {
  return _client
}
