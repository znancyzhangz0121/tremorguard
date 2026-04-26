import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({ example: 'Nancy Zhang' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 'name@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 68 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  age!: number;

  @ApiProperty({ example: 'secret123' })
  @IsString()
  @MinLength(6)
  password!: string;
}
