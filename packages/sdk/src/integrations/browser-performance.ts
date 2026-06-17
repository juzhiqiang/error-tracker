import { onLCP, onFID, onCLS, onINP, onTTFB } from 'web-vitals'
import type { Integration, PerformanceEvent } from '../types'
import type { ErrorTrackerClient } from '../core/client'
import { randomId } from '../core/utils'

export class BrowserPerformanceIntegration implements Integration {
  name = 'BrowserPerformance'
  private observers: PerformanceObserver[] = []

  setup(client: ErrorTrackerClient): void {
    const report = (metric: { name: string; value: number; rating: string }) => {
      const event: PerformanceEvent = {
        eventId: randomId(),
        timestamp: Date.now(),
        type: 'performance',
        kind: 'web-vital',
        name: metric.name as 'LCP' | 'FID' | 'CLS' | 'INP' | 'TTFB',
        value: metric.value,
        rating: metric.rating as 'good' | 'needs-improvement' | 'poor',
        url: typeof location !== 'undefined' ? location.href : undefined,
      }
      client.capturePerformance(event)
    }

    onLCP(report)
    onFID(report)
    onCLS(report)
    onINP(report)
    onTTFB(report)
    this.observeResources(client)
    this.observeLongTasks(client)
  }

  teardown(): void {
    for (const observer of this.observers) observer.disconnect()
    this.observers = []
  }

  private observeResources(client: ErrorTrackerClient): void {
    if (!supportsEntry('resource')) return

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
        client.capturePerformance({
          eventId: randomId(),
          timestamp: Date.now(),
          type: 'performance',
          kind: 'resource',
          name: 'resource',
          value: entry.duration,
          duration: entry.duration,
          url: entry.name,
          initiatorType: entry.initiatorType,
          transferSize: entry.transferSize,
          encodedBodySize: entry.encodedBodySize,
          decodedBodySize: entry.decodedBodySize,
        })
      }
    })
    observer.observe({ type: 'resource', buffered: true })
    this.observers.push(observer)
  }

  private observeLongTasks(client: ErrorTrackerClient): void {
    if (!supportsEntry('longtask')) return

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        client.capturePerformance({
          eventId: randomId(),
          timestamp: Date.now(),
          type: 'performance',
          kind: 'longtask',
          name: 'longtask',
          value: entry.duration,
          duration: entry.duration,
          startTime: entry.startTime,
        })
      }
    })
    observer.observe({ type: 'longtask', buffered: true })
    this.observers.push(observer)
  }
}

function supportsEntry(type: string): boolean {
  return (
    typeof PerformanceObserver !== 'undefined' &&
    Array.isArray(PerformanceObserver.supportedEntryTypes) &&
    PerformanceObserver.supportedEntryTypes.includes(type)
  )
}
