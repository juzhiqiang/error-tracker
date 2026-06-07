import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import type { JobType, Queue } from 'bullmq'

const QUEUE_COUNT_TYPES: JobType[] = ['waiting', 'active', 'failed', 'delayed']

export type QueueCounts = Record<string, number>

export interface QueueCountsReport {
  ingest: QueueCounts
  events: QueueCounts
  cleanup: QueueCounts
}

export type IngestRejectReason = 'rate_limited' | 'payload_too_large' | 'validation_failed'

export interface IngestMetrics {
  accepted: number
  rejected: number
  rateLimited: number
  payloadTooLarge: number
  validationFailed: number
}

@Injectable()
export class MetricsService {
  private readonly ingestCounters: IngestMetrics = {
    accepted: 0,
    rejected: 0,
    rateLimited: 0,
    payloadTooLarge: 0,
    validationFailed: 0,
  }

  constructor(
    @InjectQueue('ingest') private readonly ingestQueue: Queue,
    @InjectQueue('events') private readonly eventsQueue: Queue,
    @InjectQueue('cleanup') private readonly cleanupQueue: Queue,
  ) {}

  async queueCounts(): Promise<QueueCountsReport> {
    const [ingest, events, cleanup] = await Promise.all([
      this.ingestQueue.getJobCounts(...QUEUE_COUNT_TYPES),
      this.eventsQueue.getJobCounts(...QUEUE_COUNT_TYPES),
      this.cleanupQueue.getJobCounts(...QUEUE_COUNT_TYPES),
    ])

    return { ingest, events, cleanup }
  }

  recordIngestAccepted(): void {
    this.ingestCounters.accepted += 1
  }

  recordIngestRejected(reason: IngestRejectReason): void {
    this.ingestCounters.rejected += 1
    if (reason === 'rate_limited') this.ingestCounters.rateLimited += 1
    if (reason === 'payload_too_large') this.ingestCounters.payloadTooLarge += 1
    if (reason === 'validation_failed') this.ingestCounters.validationFailed += 1
  }

  ingestMetrics(): IngestMetrics {
    return { ...this.ingestCounters }
  }
}
