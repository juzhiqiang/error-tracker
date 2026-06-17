import { describe, expect, it } from 'bun:test'
import { applyTraceHeaders, createTraceContext, shouldPropagateTrace } from '../core/tracing'

describe('tracing helpers', () => {
  it('creates sentry and W3C compatible trace headers', () => {
    const trace = createTraceContext(1)

    expect(trace.traceId).toMatch(/^[0-9a-f]{32}$/)
    expect(trace.spanId).toMatch(/^[0-9a-f]{16}$/)
    expect(trace.headers['sentry-trace']).toBe(`${trace.traceId}-${trace.spanId}-1`)
    expect(trace.headers.traceparent).toBe(`00-${trace.traceId}-${trace.spanId}-01`)
    expect(trace.headers.baggage).toContain(`sentry-trace_id=${trace.traceId}`)
    expect(trace.headers.baggage).toContain('sentry-sample_rate=1')
  })

  it('propagates to same-origin URLs by default', () => {
    expect(shouldPropagateTrace('/api/users', { enabled: true }, 'https://app.example.com/dashboard')).toBe(true)
    expect(shouldPropagateTrace('https://app.example.com/api/users', { enabled: true }, 'https://app.example.com/dashboard')).toBe(true)
    expect(shouldPropagateTrace('https://api.example.com/users', { enabled: true }, 'https://app.example.com/dashboard')).toBe(false)
  })

  it('propagates to configured string and regexp targets', () => {
    const options = {
      enabled: true,
      tracePropagationTargets: ['https://api.example.com', /https:\/\/edge\.example\.com\/v\d+/],
    }

    expect(shouldPropagateTrace('https://api.example.com/users', options, 'https://app.example.com')).toBe(true)
    expect(shouldPropagateTrace('https://edge.example.com/v1/events', options, 'https://app.example.com')).toBe(true)
    expect(shouldPropagateTrace('https://cdn.example.com/app.js', options, 'https://app.example.com')).toBe(false)
  })

  it('does not overwrite existing trace headers', () => {
    const headers = new Headers({
      'sentry-trace': 'existing',
      baggage: 'existing-baggage',
      traceparent: 'existing-parent',
    })

    applyTraceHeaders(headers, createTraceContext(0.5))

    expect(headers.get('sentry-trace')).toBe('existing')
    expect(headers.get('baggage')).toBe('existing-baggage')
    expect(headers.get('traceparent')).toBe('existing-parent')
  })
})
