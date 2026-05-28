import type { Integration } from '../types'
import type { ErrorTrackerClient } from '../core/client'

export class BrowserErrorsIntegration implements Integration {
  name = 'BrowserErrors'
  private handlers: Array<[string, EventListenerOrEventListenerObject]> = []

  setup(client: ErrorTrackerClient): void {
    const onError = (event: ErrorEvent) => {
      if (event.error instanceof Error) {
        client.captureException(event.error)
      } else {
        client.captureException(new Error(event.message ?? 'Unknown error'))
      }
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
      client.captureException(error)
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    this.handlers.push(['error', onError as EventListener], [
      'unhandledrejection',
      onUnhandledRejection as EventListener,
    ])
  }

  teardown(): void {
    for (const [type, handler] of this.handlers) {
      window.removeEventListener(type, handler as EventListener)
    }
    this.handlers = []
  }
}
