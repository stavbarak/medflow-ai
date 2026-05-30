import {
  applyTimeToAppointmentDay,
  textHasExplicitTime,
} from './appointment-datetime';

export type AdditiveUpdatePatch = {
  title?: string;
  dateTime?: string;
  timeKnown?: boolean;
  location?: string;
  notes?: string;
  transport?: string;
  transportNotes?: string;
};

export type BuiltAdditiveUpdate = {
  patch: AdditiveUpdatePatch;
  timeMentionedInMessage: boolean;
};

type AppointmentRow = {
  dateTime: Date;
};

/**
 * Patch schedule ONLY when the user explicitly gave a time in this message.
 * Never touch dateTime when they only mention a date or visit details.
 */
export function buildSchedulePatch(
  payload: string,
  target: AppointmentRow,
): BuiltAdditiveUpdate {
  const patch: AdditiveUpdatePatch = {};
  if (!textHasExplicitTime(payload)) {
    return { patch, timeMentionedInMessage: false };
  }

  const timeOnly = applyTimeToAppointmentDay(
    new Date(target.dateTime),
    payload,
  );
  if (timeOnly) {
    patch.dateTime = timeOnly.dateTime;
    patch.timeKnown = true;
    return { patch, timeMentionedInMessage: true };
  }

  return { patch, timeMentionedInMessage: false };
}
