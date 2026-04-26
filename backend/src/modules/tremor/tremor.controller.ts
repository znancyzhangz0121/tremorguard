import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TremorService } from './tremor.service';

@ApiTags('tremor')
@Controller('tremor')
export class TremorController {
  constructor(
    @Inject(TremorService)
    private readonly tremorService: TremorService,
  ) {}

  @Get('timeline')
  @ApiOperation({ summary: 'Get tremor timeline for dashboard' })
  getTimeline() {
    return this.tremorService.getTimeline();
  }
}
