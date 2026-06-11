import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateContactDto {
  @IsString()
  @MinLength(1, { message: 'שם נדרש' })
  name: string;

  @IsString()
  @MinLength(3, { message: 'מספר נדרש' })
  value: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
