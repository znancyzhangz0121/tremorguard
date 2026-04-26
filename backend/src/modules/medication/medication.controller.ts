import { Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { MedicationService } from './medication.service';

@ApiTags('medication')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('medication')
export class MedicationController {
  constructor(
    @Inject(MedicationService)
    private readonly medicationService: MedicationService,
  ) {}

  @Get('records')
  @ApiOperation({ summary: 'Get medication records' })
  getRecords() {
    return this.medicationService.getRecords();
  }

  @Post('check-in')
  @ApiOperation({ summary: 'Create medication check-in' })
  checkIn() {
    return this.medicationService.checkIn();
  }
}
