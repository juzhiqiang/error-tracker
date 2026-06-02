import { Module } from '@nestjs/common'
import { StatsController } from './stats.controller'
import { StatsService } from './stats.service'
import { AccessModule } from '../access/access.module'

@Module({
  imports: [AccessModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
