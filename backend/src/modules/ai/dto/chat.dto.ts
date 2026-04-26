import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChatDto {
  @ApiProperty({ example: '为什么下午手抖加剧？' })
  @IsString()
  @MinLength(1)
  message!: string;
}
