import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateRequirementDto {
  @IsString()
  @MinLength(1, { message: 'תיאור נדרש' })
  description: string;

  @IsOptional()
  @IsBoolean()
  isDone?: boolean;
}
