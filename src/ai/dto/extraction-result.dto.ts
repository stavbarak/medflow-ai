import {
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';


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
  @IsString()
  transport?: string;

  @IsOptional()
  @IsString()
  transportDriver?: string;

  @IsOptional()
  @IsString()
  transportNotes?: string;
}
