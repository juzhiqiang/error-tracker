import type { Integration } from '../types'
import type { ErrorTrackerClient } from '../core/client'

export class BrowserErrorsIntegration implements Integration {
  name = 'BrowserErrors'
  private handlers: Array<[string, EventListenerOrEventListenerObject, boolean | EventListenerOptions | undefined]> = []

  setup(client: ErrorTrackerClient): void {
    const onError = (event: ErrorEvent) => {
      const resource = getFailedResource(event.target)
      if (resource) {
        client.captureException(new Error(`Resource load failed: ${resource.type} ${resource.url}`.trim()), {
          mechanism: 'resource',
          resourceType: resource.type,
          resourceUrl: resource.url,
        })
        return
      }

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

    window.addEventListener('error', onError, true)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    this.handlers.push(['error', onError as EventListener, true], [
      'unhandledrejection',
      onUnhandledRejection as EventListener,
      undefined,
    ])
  }

  teardown(): void {
    for (const [type, handler, options] of this.handlers) {
      window.removeEventListener(type, handler as EventListener, options)
    }
    this.handlers = []
  }
}

function getFailedResource(target: EventTarget | null): { type: string; url: string } | null {
  if (!target || typeof (target as { tagName?: unknown }).tagName !== 'string') return null

  const element = target as Element & { src?: string; currentSrc?: string; href?: string }
  const type = element.tagName.toLowerCase()
  if (!['img', 'script', 'link'].includes(type)) return null

  const url = type === 'link' ? element.href : element.currentSrc || element.src || element.href
  return { type, url: url ?? '' }
}
