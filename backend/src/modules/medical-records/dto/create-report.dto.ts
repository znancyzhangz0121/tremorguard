import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsOptional } from 'class-validator'

export class CreateLongitudinalReportDto {
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  forceRegenerate?: boolean
}
