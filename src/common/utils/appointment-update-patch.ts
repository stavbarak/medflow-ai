import {
  applyTimeToAppointmentDay,
  parseAppointmentWhenFromText,
  textHasExplicitTime,
} from './appointment-datetime';
export type AdditiveUpdatePatch = {
  title?: string;
  dateTime?: string;
  location?: string;
  notes?: string;
};

export type BuiltAdditiveUpdate = {
  patch: AdditiveUpdatePatch;
  hasTime: boolean;
};

type AppointmentRow = {
  dateTime: Date;
  title: string;
  location: string;
  notes: string;
};

/**
 * Build a minimal patch: only fields the user asked to change in this message.
 * Everything else on the appointment stays as-is.
 */
export function buildAdditiveUpdatePatch(
  payload: string,
  target: AppointmentRow,
  opts: {
    wantsTimeChange: boolean;
  },
): BuiltAdditiveUpdate {
  const patch: AdditiveUpdatePatch = {};
  let hasTime = false;

  if (opts.wantsTimeChange) {
    const parsedWhen = parseAppointmentWhenFromText(payload);
    if (parsedWhen) {
      patch.dateTime = parsedWhen.dateTime;
      hasTime = parsedWhen.hasTime;
    } else if (textHasExplicitTime(payload)) {
      const timeOnly = applyTimeToAppointmentDay(
        new Date(target.dateTime),
        payload,
      );
      if (timeOnly) {
        patch.dateTime = timeOnly.dateTime;
        hasTime = true;
      }
    }
  }

  return { patch, hasTime };
}
