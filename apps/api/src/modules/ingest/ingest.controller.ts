import { Controller, Post, Param, Body, UseGuards, HttpCode, HttpException, HttpStatus } from '@nestjs/common'
import { DsnAuthGuard } from '../../common/guards/dsn-auth.guard'
import { IngestService } from './ingest.service'
import { validateIngestBody, validateReplayBody } from './ingest.validation'
import { IngestLimitsService } from './ingest.limits'
import { IngestRejectReason, MetricsService } from '../observability/metrics.service'

@Controller('ingest')
export class IngestController {
  constructor(
    private readonly ingestService: IngestService,
    private readonly ingestLimits: IngestLimitsService,
    private readonly metrics: MetricsService,
  ) {}

  @Post(':projectId')
  @UseGuards(DsnAuthGuard)
  @HttpCode(202)
  async ingest(@Param('projectId') projectId: string, @Body() body: { events: unknown[]; sentAt: string }) {
    return this.handleIngest(projectId, body)
  }

  @Post(':projectId/replay')
  @UseGuards(DsnAuthGuard)
  @HttpCode(202)
  async ingestReplay(@Param('projectId') projectId: string, @Body() body: { eventId: string; events: unknown[] }) {
    return this.handleReplay(projectId, body)
  }

  @Post(':projectId/:token')
  @UseGuards(DsnAuthGuard)
  @HttpCode(202)
  async ingestWithPathToken(@Param('projectId') projectId: string, @Body() body: { events: unknown[]; sentAt: string }) {
    return this.handleIngest(projectId, body)
  }

  @Post(':projectId/:token/replay')
  @UseGuards(DsnAuthGuard)
  @HttpCode(202)
  async ingestReplayWithPathToken(
    @Param('projectId') projectId: string,
    @Body() body: { eventId: string; events: unknown[] },
  ) {
    return this.handleReplay(projectId, body)
  }

  private async handleIngest(projectId: string, body: { events: unknown[]; sentAt: string }) {
    try {
      this.ingestLimits.assertBodySize('ingest', body)
      await this.ingestLimits.assertRequestAllowed(projectId)
      const validated = validateIngestBody(body)
      await this.ingestLimits.assertDailyQuota(projectId, validated.events.length)
      await this.ingestService.enqueueBatch(projectId, validated.events)

      this.metrics.recordIngestAccepted()
      return { ok: true }
    } catch (err) {
      this.metrics.recordIngestRejected(this.rejectionReason(err))
      throw err
    }
  }

  private async handleReplay(projectId: string, body: { eventId: string; events: unknown[] }) {
    try {
      this.ingestLimits.assertBodySize('replay', body)
      await this.ingestLimits.assertRequestAllowed(projectId)
      const validated = validateReplayBody(body)
      await this.ingestService.ingestReplay(projectId, validated.eventId, validated.events)
      this.metrics.recordIngestAccepted()
      return { ok: true }
    } catch (err) {
      this.metrics.recordIngestRejected(this.rejectionReason(err))
      throw err
    }
  }

  private rejectionReason(err: unknown): IngestRejectReason {
    if (err instanceof HttpException && err.getStatus() === HttpStatus.TOO_MANY_REQUESTS) return 'rate_limited'
    if (err instanceof HttpException && err.getStatus() === HttpStatus.PAYLOAD_TOO_LARGE) return 'payload_too_large'
    return 'validation_failed'
  }
}
