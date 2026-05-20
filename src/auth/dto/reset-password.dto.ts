import { IsString, Length, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(9, { message: 'מספר טלפון לא תקין' })
  phoneNumber: string;

  @IsString()
  @Length(6, 6, { message: 'קוד אימות חייב להכיל 6 ספרות' })
  code: string;

  @IsString()
  @MinLength(6, { message: 'סיסמה חייבת להכיל לפחות 6 תווים' })
  newPassword: string;
}
