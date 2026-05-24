import { Gender } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'שם לא תקין' })
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(9, { message: 'מספר טלפון לא תקין' })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsEnum(Gender, { message: 'מין לא תקין' })
  gender?: Gender;
}
