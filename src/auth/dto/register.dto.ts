import { IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(1, { message: 'שם הוא שדה חובה' })
  name: string;

  @IsString()
  @MinLength(9, { message: 'מספר טלפון לא תקין' })
  phoneNumber: string;

  @IsString()
  @MinLength(6, { message: 'סיסמה חייבת להכיל לפחות 6 תווים' })
  password: string;

  @IsOptional()
  @IsString()
  role?: string;
}
