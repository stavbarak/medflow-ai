import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(9, { message: 'מספר טלפון לא תקין' })
  phoneNumber: string;

  @IsString()
  @MinLength(1, { message: 'סיסמה נדרשת' })
  password: string;
}
