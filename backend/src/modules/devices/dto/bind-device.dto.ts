import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';

export class BindDeviceDto {
  @ApiProperty({ example: '我的震颤卫士手环' })
  @IsString()
  @MinLength(1)
  deviceName!: string;

  @ApiProperty({ example: 'TG-ESP-240618' })
  @IsString()
  @MinLength(6)
  serialNumber!: string;

  @ApiProperty({ example: '638214' })
  @IsString()
  @MinLength(1)
  verificationCode!: string;

  @ApiProperty({ example: 'right' })
  @IsString()
  @IsIn(['left', 'right'])
  wearSide!: 'left' | 'right';
}
