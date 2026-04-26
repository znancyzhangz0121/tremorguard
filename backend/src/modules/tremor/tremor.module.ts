import { Module } from '@nestjs/common';
import { TremorController } from './tremor.controller';
import { TremorService } from './tremor.service';

@Module({
  controllers: [TremorController],
  providers: [TremorService],
  exports: [TremorService],
})
export class TremorModule {}
