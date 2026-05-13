import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AppointmentExtractionResultDto } from './dto/extraction-result.dto';

export function validateAppointmentExtraction(
  raw: unknown,
): AppointmentExtractionResultDto {
  const obj =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {};
  const dto = plainToInstance(AppointmentExtractionResultDto, obj);
  const errors = validateSync(dto, {
    whitelist: true,
    forbidUnknownValues: false,
  });
  if (errors.length > 0) {
    const msg = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(msg || 'אימות נתוני חילוץ נכשל');
  }
  return dto;
}
