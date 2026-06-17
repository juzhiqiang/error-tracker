import type { TracingOptions } from '../types'

export interface TraceContext {
  traceId: string
  spanId: string
  sampled: boolean
  headers: Record<'sentry-trace' | 'baggage' | 'traceparent', string>
}

export function createTraceContext(sampleRate = 1): TraceContext {
  const traceId = randomHex(32)
  const spanId = randomHex(16)
  const sampled = Math.random() <= sampleRate

  return {
    traceId,
    spanId,
    sampled,
    headers: {
      'sentry-trace': `${traceId}-${spanId}-${sampled ? '1' : '0'}`,
      baggage: `sentry-trace_id=${traceId},sentry-sample_rate=${sampleRate}`,
      traceparent: `00-${traceId}-${spanId}-${sampled ? '01' : '00'}`,
    },
  }
}

export function shouldPropagateTrace(
  url: string,
  options: TracingOptions | undefined,
  baseHref = currentHref(),
): boolean {
  if (options?.enabled === false) return false

  const absolute = toUrl(url, baseHref)
  if (!absolute) return false

  const base = toUrl(baseHref, baseHref)
  if (!base) return false

  const targets = options?.tracePropagationTargets
  if (!targets?.length) return absolute.origin === base.origin

  const href = absolute.href
  return targets.some((target) => (typeof target === 'string' ? href.startsWith(target) : target.test(href)))
}

export function applyTraceHeaders(headers: Headers, trace: TraceContext): void {
  for (const [key, value] of Object.entries(trace.headers)) {
    if (!headers.has(key)) headers.set(key, value)
  }
}

function randomHex(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2))
  const cryptoObject = globalThis.crypto

  if (cryptoObject?.getRandomValues) {
    cryptoObject.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256)
  }

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, length)
}

function currentHref(): string {
  return typeof location !== 'undefined' ? location.href : 'http://localhost/'
}

function toUrl(url: string, baseHref: string): URL | null {
  try {
    return new URL(url, baseHref)
  } catch {
    return null
  }
}
