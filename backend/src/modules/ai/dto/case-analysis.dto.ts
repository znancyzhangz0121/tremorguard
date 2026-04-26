import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CaseAnalysisDto {
  @ApiPropertyOptional({ example: '张老先生' })
  @IsOptional()
  @IsString()
  patientName?: string;

  @ApiPropertyOptional({ example: '近半年门诊复诊摘要' })
  @IsOptional()
  @IsString()
  caseTitle?: string;

  @ApiProperty({ example: '近半年右手静止性震颤加重，下午明显，步态变慢。' })
  @IsString()
  @MinLength(5)
  chiefComplaint!: string;

  @ApiProperty({
    example:
      '3年前确诊帕金森病，近6个月震颤波动增多，午后药效维持时间缩短，偶有起步困难。',
  })
  @IsString()
  @MinLength(10)
  courseOfIllness!: string;

  @ApiPropertyOptional({
    example: '目前服用左旋多巴/苄丝肼，每日3次，服药后约1小时改善，下午3点后波动加重。',
  })
  @IsOptional()
  @IsString()
  medicationHistory?: string;

  @ApiPropertyOptional({
    example: '近2次门诊均提示继续观察波动期，并记录跌倒、冻结及睡眠情况。',
  })
  @IsOptional()
  @IsString()
  visitHistory?: string;

  @ApiPropertyOptional({
    example: '家属担心近期步态冻结增加，夜间翻身困难，想整理复诊时重点问题。',
  })
  @IsOptional()
  @IsString()
  currentConcerns?: string;
}
