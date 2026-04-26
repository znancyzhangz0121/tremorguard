import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsBase64, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

class UploadArchiveFileItemDto {
  @ApiProperty({ example: '2024-03-门诊记录.jpg' })
  @IsString()
  @MinLength(1)
  fileName!: string

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @MinLength(1)
  mimeType!: string

  @ApiProperty({ example: '/9j/4AAQSkZJRgABAQAAAQABAAD...' })
  @IsBase64()
  contentBase64!: string

  @ApiPropertyOptional({ example: '这是一张 2024 年 3 月的门诊记录照片，重点关注午后药效回潮。' })
  @IsOptional()
  @IsString()
  note?: string
}

export class UploadArchiveFilesDto {
  @ApiProperty({
    type: [UploadArchiveFileItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UploadArchiveFileItemDto)
  files!: UploadArchiveFileItemDto[]
}
