import type { Breadcrumb, Integration, SdkOptions } from '../types'
import type { ErrorTrackerClient } from '../core/client'
import { applyTraceHeaders, createTraceContext, shouldPropagateTrace } from '../core/tracing'

const CONSOLE_LEVELS = ['log', 'info', 'debug', 'warn', 'error'] as const

type ConsoleLevel = (typeof CONSOLE_LEVELS)[number]
type ListenerTarget = 'document' | 'window'

interface PrivateClientOptions {
  options?: Pick<SdkOptions, 'sampleRate' | 'tracing'>
}

interface XhrState {
  method?: string
  url?: string
  headers: Set<string>
  traceId?: string
  start?: number
}

export class BrowserBreadcrumbsIntegration implements Integration {
  name = 'BrowserBreadcrumbs'
  private origFetch?: typeof fetch
  private origConsole = new Map<ConsoleLevel, (...args: unknown[]) => void>()
  private origPushState?: History['pushState']
  private origReplaceState?: History['replaceState']
  private origXhrOpen?: XMLHttpRequest['open']
  private origXhrSend?: XMLHttpRequest['send']
  private origXhrSetRequestHeader?: XMLHttpRequest['setRequestHeader']
  private listeners: Array<[ListenerTarget, string, EventListenerOrEventListenerObject, boolean | AddEventListenerOptions | undefined]> = []
  private lastKeyboard = { target: '', timestamp: 0 }

  setup(client: ErrorTrackerClient): void {
    this.installDom(client)
    this.installNavigation(client)
    this.installFetch(client)
    this.installXhr(client)
    this.installConsole(client)
  }

  teardown(): void {
    if (this.origFetch) window.fetch = this.origFetch
    if (this.origPushState) history.pushState = this.origPushState
    if (this.origReplaceState) history.replaceState = this.origReplaceState
    if (this.origXhrOpen && typeof XMLHttpRequest !== 'undefined') XMLHttpRequest.prototype.open = this.origXhrOpen
    if (this.origXhrSend && typeof XMLHttpRequest !== 'undefined') XMLHttpRequest.prototype.send = this.origXhrSend
    if (this.origXhrSetRequestHeader && typeof XMLHttpRequest !== 'undefined') {
      XMLHttpRequest.prototype.setRequestHeader = this.origXhrSetRequestHeader
    }
    for (const [level, orig] of this.origConsole) {
      console[level] = orig as never
    }
    for (const [target, type, listener, options] of this.listeners) {
      ;(target === 'document' ? document : window).removeEventListener(type, listener as EventListener, options)
    }
    this.listeners = []
    this.origConsole.clear()
  }

  private add(client: ErrorTrackerClient, breadcrumb: Omit<Breadcrumb, 'timestamp'> & { timestamp?: number }): void {
    client.breadcrumbs.add({ timestamp: breadcrumb.timestamp ?? Date.now(), ...breadcrumb })
  }

  private installDom(client: ErrorTrackerClient): void {
    if (typeof document === 'undefined') return

    const onClick = (event: Event) => {
      const target = describeElement(event.target as HTMLElement | null)
      this.add(client, { type: 'ui.click', message: target, data: { target } })
    }
    const onKeydown = (event: Event) => {
      const target = describeElement(event.target as HTMLElement | null)
      const now = Date.now()
      if (target === this.lastKeyboard.target && now - this.lastKeyboard.timestamp < 1000) return
      this.lastKeyboard = { target, timestamp: now }
      this.add(client, { type: 'ui.input', message: target, data: { target, event: event.type } })
    }

    const options = { passive: true, capture: true }
    document.addEventListener('click', onClick, options)
    document.addEventListener('keydown', onKeydown, options)
    this.listeners.push(['document', 'click', onClick, options], ['document', 'keydown', onKeydown, options])
  }

  private installNavigation(client: ErrorTrackerClient): void {
    if (typeof window === 'undefined' || typeof history === 'undefined') return

    const addNav = (source: string, from = location.href, to = location.href) => {
      this.add(client, { type: 'navigation', data: { from, to, source } })
    }

    this.origPushState = history.pushState
    this.origReplaceState = history.replaceState
    history.pushState = ((data: unknown, unused: string, url?: string | URL | null) => {
      const from = location.href
      const to = resolveHref(url)
      const result = this.origPushState!.call(history, data, unused, url)
      addNav('pushState', from, to)
      return result
    }) as History['pushState']
    history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
      const from = location.href
      const to = resolveHref(url)
      const result = this.origReplaceState!.call(history, data, unused, url)
      addNav('replaceState', from, to)
      return result
    }) as History['replaceState']

    const pop = () => addNav('popstate')
    const hash = () => addNav('hashchange')
    window.addEventListener('popstate', pop)
    window.addEventListener('hashchange', hash)
    this.listeners.push(['window', 'popstate', pop, undefined], ['window', 'hashchange', hash, undefined])
  }

  private installFetch(client: ErrorTrackerClient): void {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return

    this.origFetch = window.fetch.bind(window)
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = requestUrlFromInput(input)
      const method = requestMethodFromInput(input, init)
      const start = Date.now()
      const headers = new Headers(init?.headers ?? requestHeadersFromInput(input))
      const trace = createTraceContext(clientOptions(client).sampleRate ?? 1)
      if (shouldPropagateTrace(requestUrl, clientOptions(client).tracing)) applyTraceHeaders(headers, trace)

      try {
        const response = await this.origFetch!(input, { ...init, headers })
        this.add(client, {
          timestamp: start,
          type: 'http',
          data: {
            url: requestUrl,
            method,
            status: response.status,
            duration: Date.now() - start,
            transport: 'fetch',
            traceId: trace.traceId,
          },
        })
        return response
      } catch (error) {
        this.add(client, {
          timestamp: start,
          type: 'http',
          data: {
            url: requestUrl,
            method,
            error: String(error),
            duration: Date.now() - start,
            transport: 'fetch',
            traceId: trace.traceId,
          },
        })
        throw error
      }
    }) as typeof fetch
    globalThis.fetch = window.fetch
  }

  private installXhr(client: ErrorTrackerClient): void {
    if (typeof XMLHttpRequest === 'undefined') return

    this.origXhrOpen = XMLHttpRequest.prototype.open
    this.origXhrSend = XMLHttpRequest.prototype.send
    this.origXhrSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader
    const originalOpen = this.origXhrOpen
    const originalSend = this.origXhrSend
    const originalSetHeader = this.origXhrSetRequestHeader

    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]) {
      ;(this as XMLHttpRequest & { __errorTracker?: XhrState }).__errorTracker = {
        method: method.toUpperCase(),
        url: String(url),
        headers: new Set<string>(),
      }
      return originalOpen.call(this, method, url, ...(rest as [boolean?, string?, string?]))
    }

    XMLHttpRequest.prototype.setRequestHeader = function (name: string, value: string) {
      ;(this as XMLHttpRequest & { __errorTracker?: XhrState }).__errorTracker?.headers.add(name.toLowerCase())
      return originalSetHeader.call(this, name, value)
    }

    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      const xhr = this as XMLHttpRequest & { __errorTracker?: XhrState }
      const state = xhr.__errorTracker
      const trace = createTraceContext(clientOptions(client).sampleRate ?? 1)

      if (state?.url && shouldPropagateTrace(state.url, clientOptions(client).tracing)) {
        for (const [key, value] of Object.entries(trace.headers)) {
          if (!state.headers.has(key.toLowerCase())) originalSetHeader.call(this, key, value)
        }
      }
      if (state) {
        state.traceId = trace.traceId
        state.start = Date.now()
      }

      this.addEventListener('loadend', () => {
        if (!state) return
        const start = state.start ?? Date.now()
        client.breadcrumbs.add({
          timestamp: start,
          type: 'http',
          data: {
            url: state.url,
            method: state.method,
            status: this.status,
            duration: Date.now() - start,
            transport: 'xhr',
            traceId: state.traceId,
          },
        })
      })

      return originalSend.call(this, body)
    }
  }

  private installConsole(client: ErrorTrackerClient): void {
    for (const level of CONSOLE_LEVELS) {
      const orig = console[level].bind(console)
      this.origConsole.set(level, orig)
      console[level] = ((...args: unknown[]) => {
        this.add(client, {
          type: 'console',
          message: args.map(String).join(' ').slice(0, 256),
          data: { level },
        })
        orig(...args)
      }) as never
    }
  }
}

function clientOptions(client: ErrorTrackerClient): Pick<SdkOptions, 'sampleRate' | 'tracing'> {
  return (client as unknown as PrivateClientOptions).options ?? {}
}

function requestUrlFromInput(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function requestMethodFromInput(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase()
  if (typeof input === 'object' && 'method' in input && input.method) return input.method.toUpperCase()
  return 'GET'
}

function requestHeadersFromInput(input: RequestInfo | URL): HeadersInit | undefined {
  if (typeof input === 'object' && 'headers' in input) return input.headers
  return undefined
}

function describeElement(element: HTMLElement | null): string {
  if (!element?.tagName) return 'unknown'
  const tag = element.tagName.toLowerCase()
  const id = element.id ? `#${element.id}` : ''
  const className = typeof element.className === 'string' ? element.className.trim() : ''
  const classes = className ? `.${className.split(/\s+/).slice(0, 3).join('.')}` : ''
  const aria = element.getAttribute?.('aria-label')
  const text = element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 64)
  return `${tag}${id || classes || (aria ? `[aria-label="${aria.slice(0, 64)}"]` : text ? ` "${text}"` : '')}`
}

function resolveHref(url?: string | URL | null): string {
  if (!url) return location.href
  try {
    return new URL(String(url), location.href).href
  } catch {
    return location.href
  }
}
