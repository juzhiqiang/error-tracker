import { Controller, Post, Param, Body, UseGuards, HttpCode } from '@nestjs/common'
import { DsnAuthGuard } from '../../common/guards/dsn-auth.guard'
import { IngestService } from './ingest.service'
import { validateIngestBody, validateReplayBody } from './ingest.validation'
import { IngestLimitsService } from './ingest.limits'

@Controller('ingest')
export class IngestController {
  constructor(
    private readonly ingestService: IngestService,
    private readonly ingestLimits: IngestLimitsService,
  ) {}

  @Post(':projectId/:token')
  @UseGuards(DsnAuthGuard)
  @HttpCode(202)
  async ingest(@Param('projectId') projectId: string, @Body() body: { events: unknown[]; sentAt: string }) {
    this.ingestLimits.assertBodySize('ingest', body)
    this.ingestLimits.assertRequestAllowed(projectId)
    const validated = validateIngestBody(body)
    this.ingestLimits.assertDailyQuota(projectId, validated.events.length)
    const errorEvents = validated.events.filter((e: unknown) => (e as { type?: string }).type !== 'performance')
    const perfEvents = validated.events.filter((e: unknown) => (e as { type?: string }).type === 'performance')

    await Promise.all([
      ...errorEvents.map((e) => this.ingestService.ingestEvent(projectId, e as never)),
      perfEvents.length > 0 ? this.ingestService.ingestPerformance(projectId, perfEvents as never) : Promise.resolve(),
    ])

    return { ok: true }
  }

  @Post(':projectId/:token/replay')
  @UseGuards(DsnAuthGuard)
  @HttpCode(202)
  async ingestReplay(@Param('projectId') projectId: string, @Body() body: { eventId: string; events: unknown[] }) {
    this.ingestLimits.assertBodySize('replay', body)
    this.ingestLimits.assertRequestAllowed(projectId)
    const validated = validateReplayBody(body)
    await this.ingestService.ingestReplay(projectId, validated.eventId, validated.events)
    return { ok: true }
  }
}
