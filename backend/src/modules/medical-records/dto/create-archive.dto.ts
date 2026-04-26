import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator'

export class CreateArchiveDto {
  @ApiProperty({ example: '父亲历史病例档案' })
  @IsString()
  @MinLength(1)
  title!: string

  @ApiProperty({ example: '张老先生' })
  @IsString()
  @MinLength(1)
  patientName!: string

  @ApiPropertyOptional({ example: '整理近三年门诊病历、化验单和检查报告，用于复诊前纵向回顾。' })
  @IsOptional()
  @IsString()
  description?: string

  @ApiProperty({ example: true })
  @IsBoolean()
  consentAccepted!: boolean
}
