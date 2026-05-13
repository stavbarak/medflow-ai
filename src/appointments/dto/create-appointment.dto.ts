import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  @MinLength(1, { message: 'כותרת נדרשת' })
  title: string;

  @IsDateString({}, { message: 'תאריך ושעה לא תקינים' })
  dateTime: string;

  @IsString()
  @MinLength(1, { message: 'מיקום נדרש' })
  location: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;
}
