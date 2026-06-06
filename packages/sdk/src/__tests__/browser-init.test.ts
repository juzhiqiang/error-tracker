import { afterEach, describe, expect, it, mock } from 'bun:test'

mock.module('../integrations/browser-errors', () => ({
  BrowserErrorsIntegration: class BrowserErrorsIntegration {
    name = 'BrowserErrors'
    setup() {}
  },
}))

mock.module('../integrations/browser-breadcrumbs', () => ({
  BrowserBreadcrumbsIntegration: class BrowserBreadcrumbsIntegration {
    name = 'BrowserBreadcrumbs'
    setup() {}
  },
}))

mock.module('../integrations/browser-performance', () => ({
  BrowserPerformanceIntegration: class BrowserPerformanceIntegration {
    name = 'BrowserPerformance'
    setup() {}
  },
}))

describe('browser init lifecycle', () => {
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window
    delete (globalThis as unknown as { document?: unknown }).document
    delete (globalThis as unknown as { fetch?: unknown }).fetch
  })

  it('flushes queued events when the document becomes hidden', async () => {
    const documentListeners = new Map<string, EventListener[]>()
    const windowListeners = new Map<string, EventListener[]>()
    const documentStub = {
      visibilityState: 'visible',
      addEventListener: (type: string, listener: EventListener) => {
        documentListeners.set(type, [...(documentListeners.get(type) ?? []), listener])
      },
    }
    const windowStub = {
      addEventListener: (type: string, listener: EventListener) => {
        windowListeners.set(type, [...(windowListeners.get(type) ?? []), listener])
      },
    }
    const fetchMock = mock(async () => new Response(null, { status: 202 }))

    ;(globalThis as unknown as { window: typeof window }).window = windowStub as typeof window
    ;(globalThis as unknown as { document: typeof document }).document = documentStub as typeof document
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { captureMessage, init } = await import('../index')
    init({ dsn: 'http://localhost:3002/ingest/project/token' })
    captureMessage('flush on hidden')

    documentStub.visibilityState = 'hidden'
    for (const listener of documentListeners.get('visibilitychange') ?? []) {
      listener(new Event('visibilitychange'))
    }

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(windowListeners.get('visibilitychange')).toBeUndefined()
    expect(fetchMock.mock.calls).toHaveLength(1)
  })
})
