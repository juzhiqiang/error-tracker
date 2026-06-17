import { BadRequestException } from '@nestjs/common'

const MAX_EVENTS_PER_BATCH = 50
const MAX_REPLAY_EVENTS = 10_000
const LEVELS = new Set(['fatal', 'error', 'warning', 'info', 'debug'])
const PERFORMANCE_KINDS = new Set(['web-vital', 'resource', 'http', 'longtask'])
const WEB_VITAL_NAMES = new Set(['LCP', 'FID', 'CLS', 'INP', 'TTFB'])
const RATINGS = new Set(['good', 'needs-improvement', 'poor'])

interface IngestBody {
  events: unknown[]
  sentAt?: string
}

interface ReplayBody {
  eventId: string
  events: unknown[]
}

export function validateIngestBody(body: unknown): IngestBody {
  if (!isRecord(body) || !Array.isArray(body.events)) {
    throw new BadRequestException('events must be an array')
  }
  if (body.events.length > MAX_EVENTS_PER_BATCH) {
    throw new BadRequestException(`events cannot exceed ${MAX_EVENTS_PER_BATCH} items`)
  }

  body.events.forEach((event, index) => {
    if (!isRecord(event)) throw new BadRequestException(`events[${index}] must be an object`)
    if (event.type === 'performance') {
      validatePerformanceEvent(event, index)
      return
    }
    validateErrorEvent(event, index)
  })

  return body as unknown as IngestBody
}

export function validateReplayBody(body: unknown): ReplayBody {
  if (!isRecord(body) || typeof body.eventId !== 'string' || body.eventId.length === 0) {
    throw new BadRequestException('eventId is required')
  }
  if (!Array.isArray(body.events) || body.events.length === 0) {
    throw new BadRequestException('replay events must be a non-empty array')
  }
  if (body.events.length > MAX_REPLAY_EVENTS) {
    throw new BadRequestException(`replay events cannot exceed ${MAX_REPLAY_EVENTS} items`)
  }
  return body as unknown as ReplayBody
}

function validateErrorEvent(event: Record<string, unknown>, index: number): void {
  requireString(event.eventId, `events[${index}].eventId`)
  requireNumber(event.timestamp, `events[${index}].timestamp`)
  requireString(event.message, `events[${index}].message`)
  requireString(event.fingerprint, `events[${index}].fingerprint`)
  if (typeof event.level !== 'string' || !LEVELS.has(event.level)) {
    throw new BadRequestException(`events[${index}].level is invalid`)
  }
}

function validatePerformanceEvent(event: Record<string, unknown>, index: number): void {
  requireString(event.eventId, `events[${index}].eventId`)
  requireNumber(event.timestamp, `events[${index}].timestamp`)
  requireNumber(event.value, `events[${index}].value`)
  const kind = typeof event.kind === 'string' ? event.kind : 'web-vital'
  if (!PERFORMANCE_KINDS.has(kind)) {
    throw new BadRequestException(`events[${index}].kind is invalid`)
  }
  requireString(event.name, `events[${index}].name`)
  if (kind === 'web-vital') {
    if (typeof event.name !== 'string' || !WEB_VITAL_NAMES.has(event.name)) {
      throw new BadRequestException(`events[${index}].name is invalid`)
    }
    if (typeof event.rating !== 'string' || !RATINGS.has(event.rating)) {
      throw new BadRequestException(`events[${index}].rating is invalid`)
    }
  }
}

function requireString(value: unknown, name: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new BadRequestException(`${name} is required`)
  }
}

function requireNumber(value: unknown, name: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BadRequestException(`${name} must be a finite number`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
