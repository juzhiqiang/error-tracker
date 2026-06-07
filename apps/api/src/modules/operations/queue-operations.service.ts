import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, NotFoundException } from '@nestjs/common'
import type { JobType, Queue } from 'bullmq'

const QUEUE_COUNT_TYPES: JobType[] = ['waiting', 'active', 'failed', 'delayed']
export type OperationsQueueName = 'ingest' | 'events' | 'cleanup'

export interface QueueFailedJobSummary {
  id: string
  name: string
  failedReason: string | null
  timestamp: number
}

export interface QueueOperationsSnapshot {
  counts: Record<string, number>
  failedJobs: QueueFailedJobSummary[]
}

@Injectable()
export class QueueOperationsService {
  constructor(
    @InjectQueue('ingest') private readonly ingestQueue: Queue,
    @InjectQueue('events') private readonly eventsQueue: Queue,
    @InjectQueue('cleanup') private readonly cleanupQueue: Queue,
  ) {}

  async list(): Promise<Record<OperationsQueueName, QueueOperationsSnapshot>> {
    const [ingest, events, cleanup] = await Promise.all([
      this.describe(this.ingestQueue),
      this.describe(this.eventsQueue),
      this.describe(this.cleanupQueue),
    ])
    return { ingest, events, cleanup }
  }

  async retry(queueName: OperationsQueueName, jobId: string): Promise<{ ok: true }> {
    const job = await this.getJob(queueName, jobId)
    await job.retry()
    return { ok: true }
  }

  async remove(queueName: OperationsQueueName, jobId: string): Promise<{ ok: true }> {
    const job = await this.getJob(queueName, jobId)
    await job.remove()
    return { ok: true }
  }

  private async describe(queue: Queue): Promise<QueueOperationsSnapshot> {
    const [counts, failedJobs] = await Promise.all([
      queue.getJobCounts(...QUEUE_COUNT_TYPES),
      queue.getJobs(['failed'], 0, 20),
    ])

    return {
      counts,
      failedJobs: failedJobs.map((job) => ({
        id: String(job.id),
        name: job.name,
        failedReason: job.failedReason ?? null,
        timestamp: job.timestamp,
      })),
    }
  }

  private async getJob(queueName: OperationsQueueName, jobId: string) {
    const queue = this.queueFor(queueName)
    const job = await queue.getJob(jobId)
    if (!job) {
      throw new NotFoundException('Queue job not found')
    }
    return job
  }

  private queueFor(queueName: OperationsQueueName): Queue {
    if (queueName === 'ingest') return this.ingestQueue
    if (queueName === 'events') return this.eventsQueue
    if (queueName === 'cleanup') return this.cleanupQueue
    throw new NotFoundException('Queue not found')
  }
}
