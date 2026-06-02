import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common'
import { HealthService } from './health.service'

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async health() {
    const report = await this.healthService.check()
    if (!report.ok) {
      throw new HttpException(report, HttpStatus.SERVICE_UNAVAILABLE)
    }
    return report
  }
}
