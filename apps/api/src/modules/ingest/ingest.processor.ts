import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { IngestService } from './ingest.service'
import { validateIngestBody } from './ingest.validation'

interface IngestBatchJob {
  projectId: string
  events: unknown[]
}

@Processor('ingest')
export class IngestProcessor extends WorkerHost {
  constructor(private readonly ingestService: IngestService) {
    super()
  }

  async process(job: Job<IngestBatchJob>): Promise<void> {
    if (job.name !== 'ingest-batch') return

    const validated = validateIngestBody({ events: job.data.events })
    const errorEvents = validated.events.filter((event: unknown) => (event as { type?: string }).type !== 'performance')
    const perfEvents = validated.events.filter((event: unknown) => (event as { type?: string }).type === 'performance')

    for (const event of errorEvents) {
      await this.ingestService.ingestEvent(job.data.projectId, event as never)
    }
    if (perfEvents.length > 0) {
      await this.ingestService.ingestPerformance(job.data.projectId, perfEvents as never)
    }
  }
}
