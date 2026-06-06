'use client'

import { useEffect } from 'react'
import { init } from '@error-tracker/sdk'
import { getWebSelfMonitoringOptions } from '@/lib/self-monitoring'

let initialized = false
type CapturedErrorEvent = { tags?: Record<string, string> }

export function SelfMonitoringProvider() {
  useEffect(() => {
    if (initialized) return

    const options = getWebSelfMonitoringOptions({
      NEXT_PUBLIC_ERROR_TRACKER_DSN: process.env.NEXT_PUBLIC_ERROR_TRACKER_DSN,
      NEXT_PUBLIC_ERROR_TRACKER_SELF_MONITORING_ENABLED:
        process.env.NEXT_PUBLIC_ERROR_TRACKER_SELF_MONITORING_ENABLED,
      NEXT_PUBLIC_ERROR_TRACKER_ENVIRONMENT: process.env.NEXT_PUBLIC_ERROR_TRACKER_ENVIRONMENT,
      NEXT_PUBLIC_ERROR_TRACKER_RELEASE: process.env.NEXT_PUBLIC_ERROR_TRACKER_RELEASE,
    })
    if (!options.enabled) return

    try {
      initialized = true
      const client = init({
        dsn: options.dsn,
        environment: options.environment,
        release: options.release,
        beforeSend(event: CapturedErrorEvent) {
          return { ...event, tags: { ...event.tags, ...options.tags } }
        },
      })

      for (const [key, value] of Object.entries(options.tags)) {
        client.scope.setTag(key, value)
      }
    } catch {
      initialized = false
    }
  }, [])

  return null
}
