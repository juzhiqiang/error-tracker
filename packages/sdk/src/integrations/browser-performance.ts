import { onLCP, onFID, onCLS, onINP, onTTFB } from 'web-vitals'
import type { Integration, PerformanceEvent } from '../types'
import type { ErrorTrackerClient } from '../core/client'
import { randomId } from '../core/utils'

export class BrowserPerformanceIntegration implements Integration {
  name = 'BrowserPerformance'

  setup(client: ErrorTrackerClient): void {
    const report = (metric: { name: string; value: number; rating: string }) => {
      const event: PerformanceEvent = {
        eventId: randomId(),
        timestamp: Date.now(),
        type: 'performance',
        name: metric.name as PerformanceEvent['name'],
        value: metric.value,
        rating: metric.rating as PerformanceEvent['rating'],
        url: location.href,
      }
      client.capturePerformance(event)
    }

    onLCP(report)
    onFID(report)
    onCLS(report)
    onINP(report)
    onTTFB(report)
  }
}
