import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { ErrorTrackerClient } from '../core/client'
import { BrowserErrorsIntegration } from '../integrations/browser-errors'

describe('BrowserErrorsIntegration', () => {
  let listeners: Array<{
    type: string
    listener: EventListenerOrEventListenerObject
    options?: boolean | AddEventListenerOptions
  }> = []

  beforeEach(() => {
    listeners = []
    const windowStub = {
      addEventListener: (
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
      ) => {
        listeners.push({ type, listener, options })
      },
      removeEventListener: () => {},
    }
    ;(globalThis as unknown as { window: Window }).window = windowStub as unknown as Window
    globalThis.fetch = mock(async () => new Response(null, { status: 202 })) as unknown as typeof fetch
  })

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window
    delete (globalThis as unknown as { fetch?: unknown }).fetch
  })

  for (const resource of [
    { tagName: 'img', urlProperty: 'src', url: 'https://cdn.example.com/logo.png' },
    { tagName: 'script', urlProperty: 'src', url: 'https://cdn.example.com/app.js' },
    { tagName: 'link', urlProperty: 'href', url: 'https://cdn.example.com/app.css' },
  ] as const) {
    it(`captures ${resource.tagName.toUpperCase()} load failures from the error capture phase`, async () => {
      const client = new ErrorTrackerClient({ dsn: 'http://localhost:3002/ingest/project/token' })
      new BrowserErrorsIntegration().setup(client)

      const errorListener = listeners.find((entry) => entry.type === 'error')
      expect(errorListener?.options).toBe(true)

      dispatch(errorListener?.listener, resourceErrorEvent(resource.tagName, resource.urlProperty, resource.url))
      await client.flush()
      await new Promise((resolve) => setTimeout(resolve, 10))

      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof mock>
      const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
      expect(body.events[0].message).toBe(`Resource load failed: ${resource.tagName} ${resource.url}`)
      expect(body.events[0].tags).toMatchObject({
        mechanism: 'resource',
        resourceType: resource.tagName,
        resourceUrl: resource.url,
      })
    })
  }

  it('still captures JavaScript runtime errors from the error event', async () => {
    const client = new ErrorTrackerClient({ dsn: 'http://localhost:3002/ingest/project/token' })
    new BrowserErrorsIntegration().setup(client)

    const errorListener = listeners.find((entry) => entry.type === 'error')
    expect(errorListener?.options).toBe(true)

    dispatch(errorListener?.listener, {
      type: 'error',
      target: globalThis.window,
      error: new Error('runtime boom'),
    } as unknown as ErrorEvent)
    await client.flush()
    await new Promise((resolve) => setTimeout(resolve, 10))

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof mock>
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body.events[0].message).toBe('runtime boom')
  })
})

function dispatch(listener: EventListenerOrEventListenerObject | undefined, event: Event): void {
  if (typeof listener === 'function') {
    listener(event)
    return
  }
  listener?.handleEvent(event)
}

function resourceErrorEvent(tagName: string, urlProperty: 'src' | 'href', source: string): Event {
  return {
    type: 'error',
    target: {
      tagName: tagName.toUpperCase(),
      [urlProperty]: source,
    },
  } as unknown as Event
}
