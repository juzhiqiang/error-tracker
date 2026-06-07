import { describe, expect, it } from 'bun:test'
import { getWebSelfMonitoringOptions } from './self-monitoring'

describe('web self monitoring config', () => {
  it('stays disabled until a public DSN is configured', () => {
    expect(getWebSelfMonitoringOptions({})).toEqual({ enabled: false })
  })

  it('builds SDK options with service tags when enabled', () => {
    expect(
      getWebSelfMonitoringOptions({
        NEXT_PUBLIC_ERROR_TRACKER_DSN: 'http://localhost:3002/ingest/self',
        NEXT_PUBLIC_ERROR_TRACKER_TOKEN: 'token',
        NEXT_PUBLIC_ERROR_TRACKER_ENVIRONMENT: 'staging',
        NEXT_PUBLIC_ERROR_TRACKER_RELEASE: 'web@1.2.3',
      }),
    ).toEqual({
      enabled: true,
      dsn: 'http://localhost:3002/ingest/self',
      token: 'token',
      environment: 'staging',
      release: 'web@1.2.3',
      tags: { service: 'web', source: 'self-monitoring' },
    })
  })

  it('can be explicitly disabled even when a DSN is present', () => {
    expect(
      getWebSelfMonitoringOptions({
        NEXT_PUBLIC_ERROR_TRACKER_DSN: 'http://localhost:3002/ingest/self/token',
        NEXT_PUBLIC_ERROR_TRACKER_SELF_MONITORING_ENABLED: 'false',
      }),
    ).toEqual({ enabled: false })
  })
})
