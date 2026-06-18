import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { ErrorTrackerClient } from '../core/client'

const webVitalCallbacks: Record<string, (metric: { name: string; value: number; rating: string }) => void> = {}

mock.module('web-vitals', () => ({
  onLCP: (callback: (metric: { name: string; value: number; rating: string }) => void) => {
    webVitalCallbacks.LCP = callback
  },
  onFID: (callback: (metric: { name: string; value: number; rating: string }) => void) => {
    webVitalCallbacks.FID = callback
  },
  onCLS: (callback: (metric: { name: string; value: number; rating: string }) => void) => {
    webVitalCallbacks.CLS = callback
  },
  onINP: (callback: (metric: { name: string; value: number; rating: string }) => void) => {
    webVitalCallbacks.INP = callback
  },
  onTTFB: (callback: (metric: { name: string; value: number; rating: string }) => void) => {
    webVitalCallbacks.TTFB = callback
  },
  onFCP: (callback: (metric: { name: string; value: number; rating: string }) => void) => {
    webVitalCallbacks.FCP = callback
  },
}))

const { BrowserPerformanceIntegration } = await import('../integrations/browser-performance')

describe('BrowserPerformanceIntegration observers', () => {
  afterEach(() => {
    delete (globalThis as unknown as { PerformanceObserver?: unknown }).PerformanceObserver
    delete (globalThis as unknown as { document?: unknown }).document
    delete (globalThis as unknown as { location?: unknown }).location
    Object.keys(webVitalCallbacks).forEach((key) => delete webVitalCallbacks[key])
  })

  it('captures every web-vitals metric supported by the SDK', () => {
    const events: unknown[] = []
    installPerformanceObserver([])
    ;(globalThis as unknown as { document: Document }).document = {} as Document
    ;(globalThis as unknown as { location: Location }).location = { href: 'https://app.example.com' } as Location

    const client = { capturePerformance: (event: unknown) => events.push(event) } as unknown as ErrorTrackerClient
    new BrowserPerformanceIntegration().setup(client)

    for (const name of ['LCP', 'FID', 'CLS', 'INP', 'TTFB', 'FCP']) {
      webVitalCallbacks[name]({ name, value: name === 'CLS' ? 0.12 : 123, rating: 'needs-improvement' })
    }

    expect(events).toHaveLength(6)
    expect(events.map((event) => (event as { name: string }).name).sort()).toEqual(['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB'])
    expect(events[0]).toMatchObject({
      type: 'performance',
      kind: 'web-vital',
      rating: 'needs-improvement',
      url: 'https://app.example.com',
    })
  })

  it('captures resource timing entries as performance events', () => {
    const events: unknown[] = []
    const observers: FakePerformanceObserver[] = []
    installPerformanceObserver(observers)
    ;(globalThis as unknown as { location: Location }).location = { href: 'https://app.example.com' } as Location

    const client = { capturePerformance: (event: unknown) => events.push(event) } as unknown as ErrorTrackerClient
    new BrowserPerformanceIntegration().setup(client)

    observers[0].emit([
      {
        name: 'https://cdn.example.com/app.js',
        entryType: 'resource',
        initiatorType: 'script',
        duration: 42.6,
        transferSize: 1000,
        encodedBodySize: 900,
        decodedBodySize: 1200,
      } as PerformanceResourceTiming,
    ])

    expect(events[0]).toMatchObject({
      type: 'performance',
      kind: 'resource',
      name: 'resource',
      value: 42.6,
      duration: 42.6,
      url: 'https://cdn.example.com/app.js',
      initiatorType: 'script',
      transferSize: 1000,
    })
  })

  it('captures long task entries as performance events', () => {
    const events: unknown[] = []
    const observers: FakePerformanceObserver[] = []
    installPerformanceObserver(observers)

    const client = { capturePerformance: (event: unknown) => events.push(event) } as unknown as ErrorTrackerClient
    new BrowserPerformanceIntegration().setup(client)

    observers[1].emit([{ name: 'self', entryType: 'longtask', startTime: 12, duration: 88 } as PerformanceEntry])

    expect(events[0]).toMatchObject({
      type: 'performance',
      kind: 'longtask',
      name: 'longtask',
      value: 88,
      duration: 88,
      startTime: 12,
    })
  })
})

class FakePerformanceObserver {
  private callback: PerformanceObserverCallback

  constructor(callback: PerformanceObserverCallback) {
    this.callback = callback
  }

  observe(): void {}

  disconnect(): void {}

  emit(entries: PerformanceEntry[]): void {
    this.callback({ getEntries: () => entries } as PerformanceObserverEntryList, this as unknown as PerformanceObserver)
  }
}

function installPerformanceObserver(observers: FakePerformanceObserver[]): void {
  ;(globalThis as unknown as { PerformanceObserver: typeof PerformanceObserver }).PerformanceObserver =
    class extends FakePerformanceObserver {
      static supportedEntryTypes = ['resource', 'longtask']

      constructor(callback: PerformanceObserverCallback) {
        super(callback)
        observers.push(this)
      }
    } as unknown as typeof PerformanceObserver
}
