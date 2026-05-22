import {
  getJerusalemParts,
  jerusalemLocalToUtc,
  parseAppointmentWhenFromText,
  textHasExplicitTime,
} from '../common/utils/appointment-datetime';
import { validateAppointmentExtraction } from './ai-validation';
import { AppointmentExtractionResultDto } from './dto/extraction-result.dto';

export type WakeAppointmentFields = AppointmentExtractionResultDto & {
  hasTime: boolean;
};

/** Merge model output with deterministic Israel date/time parsing from the raw text. */
export function mergeWakeAppointmentExtraction(
  raw: unknown,
  sourceText: string,
  now = new Date(),
): WakeAppointmentFields {
  const dto = validateAppointmentExtraction(raw);
  const parsed = parseAppointmentWhenFromText(sourceText, now);

  if (parsed) {
    dto.dateTime = parsed.dateTime;
    return { ...dto, hasTime: parsed.hasTime };
  }

  if (dto.dateTime) {
    const parts = getJerusalemParts(new Date(dto.dateTime));
    const hasTime = textHasExplicitTime(sourceText);
    const hour = hasTime ? parts.hour : 12;
    const minute = hasTime ? parts.minute : 0;
    dto.dateTime = jerusalemLocalToUtc(
      parts.year,
      parts.month,
      parts.day,
      hour,
      minute,
    ).toISOString();
    return { ...dto, hasTime };
  }

  return { ...dto, hasTime: false };
}
