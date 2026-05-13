import { IsString, MinLength } from 'class-validator';

export class ExtractRequestDto {
  @IsString()
  @MinLength(1, { message: 'טקסט ריק' })
  text: string;
}
