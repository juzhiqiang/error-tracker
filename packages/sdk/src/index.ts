import { ErrorTrackerClient } from './core/client'
import { BrowserErrorsIntegration } from './integrations/browser-errors'
import { BrowserBreadcrumbsIntegration } from './integrations/browser-breadcrumbs'
import { BrowserPerformanceIntegration } from './integrations/browser-performance'
import { BrowserEnvironmentIntegration } from './integrations/browser-environment'
import { BrowserBlankScreenIntegration } from './integrations/browser-blank-screen'
import type { SdkOptions } from './types'

export { ErrorTrackerClient } from './core/client'
export { EnvironmentCollector } from './core/environment'
export { BrowserBlankScreenIntegration } from './integrations/browser-blank-screen'
export type { SdkOptions, Integration, ErrorEvent, Breadcrumb, EventContext, BlankScreenOptions } from './types'
export type { EnvironmentSnapshot } from './core/environment'

let _client: ErrorTrackerClient | null = null

export function init(options: SdkOptions): ErrorTrackerClient {
  const defaultIntegrations = [
    new BrowserEnvironmentIntegration(),
    new BrowserErrorsIntegration(),
    new BrowserBreadcrumbsIntegration(),
    new BrowserPerformanceIntegration(),
    ...(options.blankScreen?.enabled === false ? [] : [new BrowserBlankScreenIntegration(options.blankScreen)]),
  ]
  _client = new ErrorTrackerClient({
    ...options,
    integrations: [...defaultIntegrations, ...(options.integrations ?? [])],
  })
  _client.setupIntegrations()

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      _client?.flush(true)
    }
  })
  const flushOnPageEnd = () => _client?.flush(true)
  window.addEventListener('beforeunload', flushOnPageEnd)
  window.addEventListener('pagehide', flushOnPageEnd)

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
