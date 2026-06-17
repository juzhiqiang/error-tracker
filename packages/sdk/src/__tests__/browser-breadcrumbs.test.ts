import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { ErrorTrackerClient } from '../core/client'
import { BrowserBreadcrumbsIntegration } from '../integrations/browser-breadcrumbs'

type Listener = { type: string; listener: EventListenerOrEventListenerObject; options?: boolean | AddEventListenerOptions }

describe('BrowserBreadcrumbsIntegration', () => {
  let documentListeners: Listener[]
  let windowListeners: Listener[]
  let originalConsole: Pick<Console, 'log' | 'info' | 'debug' | 'warn' | 'error'>
  let fetchMock: ReturnType<typeof mock>

  beforeEach(() => {
    documentListeners = []
    windowListeners = []
    originalConsole = {
      log: console.log,
      info: console.info,
      debug: console.debug,
      warn: console.warn,
      error: console.error,
    }
    ;(globalThis as unknown as { location: Location }).location = {
      href: 'https://app.example.com/start',
      origin: 'https://app.example.com',
    } as Location
    ;(globalThis as unknown as { document: Document }).document = {
      addEventListener: (
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
      ) => {
        documentListeners.push({ type, listener, options })
      },
      removeEventListener: () => {},
    } as unknown as Document
    fetchMock = mock(async () => new Response(null, { status: 204 }))
    ;(globalThis as unknown as { window: Window }).window = {
      fetch: fetchMock as unknown as typeof fetch,
      addEventListener: (
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
      ) => {
        windowListeners.push({ type, listener, options })
      },
      removeEventListener: () => {},
      history: {
        pushState: function (_data: unknown, _unused: string, url?: string | URL | null) {
          if (url) globalThis.location.href = new URL(String(url), globalThis.location.href).href
        },
        replaceState: function (_data: unknown, _unused: string, url?: string | URL | null) {
          if (url) globalThis.location.href = new URL(String(url), globalThis.location.href).href
        },
      },
      location: globalThis.location,
    } as unknown as Window
    ;(globalThis as unknown as { history: History }).history = globalThis.window.history
    globalThis.fetch = globalThis.window.fetch.bind(globalThis.window)
    console.log = mock(() => undefined) as unknown as typeof console.log
    console.info = mock(() => undefined) as unknown as typeof console.info
    console.debug = mock(() => undefined) as unknown as typeof console.debug
    console.warn = mock(() => undefined) as unknown as typeof console.warn
    console.error = mock(() => undefined) as unknown as typeof console.error
  })

  afterEach(() => {
    console.log = originalConsole.log
    console.info = originalConsole.info
    console.debug = originalConsole.debug
    console.warn = originalConsole.warn
    console.error = originalConsole.error
    delete (globalThis as unknown as { window?: unknown }).window
    delete (globalThis as unknown as { document?: unknown }).document
    delete (globalThis as unknown as { history?: unknown }).history
    delete (globalThis as unknown as { location?: unknown }).location
    delete (globalThis as unknown as { XMLHttpRequest?: unknown }).XMLHttpRequest
    delete (globalThis as unknown as { fetch?: unknown }).fetch
  })

  it('records fetch breadcrumbs and injects trace headers for same-origin requests', async () => {
    const client = new ErrorTrackerClient({ dsn: 'http://localhost:3002/ingest/project/token' })
    const integration = new BrowserBreadcrumbsIntegration()
    integration.setup(client)

    await window.fetch('/api/orders', { method: 'POST' })

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers)
    expect(headers.get('sentry-trace')).toMatch(/^[0-9a-f]{32}-[0-9a-f]{16}-[01]$/)
    expect(headers.get('traceparent')).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/)
    expect(headers.get('baggage')).toContain('sentry-trace_id=')
    expect(client.breadcrumbs.getAll()[0]).toMatchObject({
      type: 'http',
      data: { url: '/api/orders', method: 'POST', status: 204, transport: 'fetch' },
    })
  })

  it('records route breadcrumbs from pushState and replaceState', () => {
    const client = new ErrorTrackerClient({ dsn: 'http://localhost:3002/ingest/project/token' })
    new BrowserBreadcrumbsIntegration().setup(client)

    history.pushState({}, '', '/issues')
    history.replaceState({}, '', '/issues/1')

    const breadcrumbs = client.breadcrumbs.getAll().filter((item) => item.type === 'navigation')
    expect(breadcrumbs).toHaveLength(2)
    expect(breadcrumbs[0].data).toMatchObject({ source: 'pushState', to: 'https://app.example.com/issues' })
    expect(breadcrumbs[1].data).toMatchObject({ source: 'replaceState', to: 'https://app.example.com/issues/1' })
  })

  it('records all console levels as breadcrumbs', () => {
    const client = new ErrorTrackerClient({ dsn: 'http://localhost:3002/ingest/project/token' })
    new BrowserBreadcrumbsIntegration().setup(client)

    console.log('log message')
    console.info('info message')
    console.debug('debug message')
    console.warn('warn message')
    console.error('error message')

    expect(client.breadcrumbs.getAll().map((item) => item.data?.level)).toEqual([
      'log',
      'info',
      'debug',
      'warn',
      'error',
    ])
  })

  it('records keyboard breadcrumbs without key values or input contents', () => {
    const client = new ErrorTrackerClient({ dsn: 'http://localhost:3002/ingest/project/token' })
    new BrowserBreadcrumbsIntegration().setup(client)

    dispatch(documentListeners.find((entry) => entry.type === 'keydown')?.listener, {
      type: 'keydown',
      target: { tagName: 'INPUT', id: 'email', value: 'ada@example.com' },
      key: 'a',
    })

    const breadcrumb = client.breadcrumbs.getAll()[0]
    expect(breadcrumb.type).toBe('ui.input')
    expect(JSON.stringify(breadcrumb)).not.toContain('ada@example.com')
    expect(JSON.stringify(breadcrumb)).not.toContain('"key":"a"')
  })

  it('records XMLHttpRequest breadcrumbs and injects trace headers', () => {
    installFakeXhr()
    const client = new ErrorTrackerClient({ dsn: 'http://localhost:3002/ingest/project/token' })
    new BrowserBreadcrumbsIntegration().setup(client)

    const xhr = new XMLHttpRequest()
    xhr.open('PUT', '/api/profile')
    xhr.send()
    ;(xhr as unknown as { complete: (status: number) => void }).complete(202)

    const headers = (xhr as unknown as { headers: Record<string, string> }).headers
    expect(headers['sentry-trace']).toMatch(/^[0-9a-f]{32}-[0-9a-f]{16}-[01]$/)
    expect(client.breadcrumbs.getAll()[0]).toMatchObject({
      type: 'http',
      data: { url: '/api/profile', method: 'PUT', status: 202, transport: 'xhr' },
    })
  })
})

function dispatch(listener: EventListenerOrEventListenerObject | undefined, event: unknown): void {
  if (typeof listener === 'function') listener(event as Event)
  else listener?.handleEvent(event as Event)
}

function installFakeXhr(): void {
  class FakeXMLHttpRequest extends EventTarget {
    status = 0
    headers: Record<string, string> = {}
    method = ''
    url = ''

    open(method: string, url: string): void {
      this.method = method
      this.url = url
    }

    setRequestHeader(name: string, value: string): void {
      this.headers[name] = value
    }

    send(): void {}

    complete(status: number): void {
      this.status = status
      this.dispatchEvent(new Event('loadend'))
    }
  }

  ;(globalThis as unknown as { XMLHttpRequest: typeof XMLHttpRequest }).XMLHttpRequest =
    FakeXMLHttpRequest as unknown as typeof XMLHttpRequest
}
