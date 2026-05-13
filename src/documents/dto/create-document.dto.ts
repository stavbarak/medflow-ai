import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateDocumentDto {
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @IsString()
  @MinLength(1, { message: 'כתובת קובץ נדרשת' })
  fileUrl: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
