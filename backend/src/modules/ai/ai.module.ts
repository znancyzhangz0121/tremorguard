import { Module } from '@nestjs/common';
import { DashboardModule } from '../dashboard/dashboard.module';
import { TremorModule } from '../tremor/tremor.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [DashboardModule, TremorModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
