import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ExtractedRequirementItemDto {
  @IsString()
  @MinLength(1)
  description: string;
}

/** Validated shape returned by the extraction model (partial appointment). */
export class AppointmentExtractionResultDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsDateString()
  dateTime?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtractedRequirementItemDto)
  requirements?: ExtractedRequirementItemDto[];
}
