import { IsString, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsString()
  @MinLength(9, { message: 'מספר טלפון לא תקין' })
  phoneNumber: string;
}
