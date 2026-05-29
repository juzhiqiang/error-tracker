import { Controller, Post, Param, Body, UseGuards, HttpCode } from '@nestjs/common'
import { DsnAuthGuard } from '../../common/guards/dsn-auth.guard'
import { IngestService } from './ingest.service'

@Controller('ingest')
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Post(':projectId/:token')
  @UseGuards(DsnAuthGuard)
  @HttpCode(202)
  async ingest(@Param('projectId') projectId: string, @Body() body: { events: unknown[]; sentAt: string }) {
    const errorEvents = (body.events ?? []).filter((e: unknown) => (e as { type?: string }).type !== 'performance')
    const perfEvents = (body.events ?? []).filter((e: unknown) => (e as { type?: string }).type === 'performance')

    await Promise.all([
      ...errorEvents.map((e) => this.ingestService.ingestEvent(projectId, e as never)),
      perfEvents.length > 0 ? this.ingestService.ingestPerformance(projectId, perfEvents as never) : Promise.resolve(),
    ])

    return { ok: true }
  }

  @Post(':projectId/:token/replay')
  @UseGuards(DsnAuthGuard)
  @HttpCode(202)
  async ingestReplay(@Param('projectId') _projectId: string, @Body() _body: { eventId: string; events: unknown[] }) {
    // MinIO 上传在 Task P2-05 实现
    return { ok: true }
  }
}
