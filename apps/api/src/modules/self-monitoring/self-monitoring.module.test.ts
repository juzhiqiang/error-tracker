import { describe, expect, it } from 'bun:test'
import { Test } from '@nestjs/testing'
import { SelfMonitoringModule } from './self-monitoring.module'
import { SelfMonitoringService } from './self-monitoring.service'

describe('SelfMonitoringModule', () => {
  it('registers the self-monitoring service with Nest dependency injection', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SelfMonitoringModule],
    }).compile()

    expect(moduleRef.get(SelfMonitoringService)).toBeInstanceOf(SelfMonitoringService)
    await moduleRef.close()
  })
})
