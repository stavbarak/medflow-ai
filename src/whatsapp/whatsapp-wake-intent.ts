import { stripWakeWord } from '../common/utils/wake-word';
import { textHasExplicitTime } from '../common/utils/appointment-datetime';

export type WakeIntent = 'list' | 'question' | 'create' | 'cancel' | 'update';

export { stripWakeWord };

const CANCEL_RE =
  /(תבטל|תבטלי|בטל|בטלי|מחק|מחקי|ביטול|לבטל|להסיר|הסר|cancel)/iu;

const UPDATE_RE =
  /(התבלבל|תתקן|תתקני|תשנה|תשני|תעדכן|עדכן|תקן|תקני|תיקון|לתקן|לשנות|לעדכן|שנה את|שני את)/iu;

/** Booking a new appointment (not editing an existing one). */
export const NEW_APPOINTMENT_RE =
  /(?:יש\s+(?:ל(?:אבא|אמא|מטופל)\s+)?תור|(?:תוסיף|תוסיפי|הוסף|הוסיפי|נוסף)\s+תור|תור\s+חדש|לקבוע|לתאם|נקבע(?:\s+תור)?)/iu;

const DATE_HINT_RE = /\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?/u;

/**
 * Refers to an appointment already in the system — not "יש תור ב-14.7" (new booking).
 * Requires definite form (התור) or "תור של …".
 */
const EXISTING_APPOINTMENT_RE =
  /(?:^|[,\s])התור\s+(?:ב|במ|ב-|ל|של|הוא|היא|בשעה)|תור\s+של(?:\s+ה)?-?|(?:^|[,\s])התור\s+הוא|שהתור\s+ל/iu;

const CLINIC_OR_SITE_RE =
  /(מרפאה|איכילוב|בית חולים|בית-חולים|מכון|קופת|הדסה|שיבא|סורוקה|אסף|רמבם)/iu;

const FIELD_UPDATE_RE =
  /(בשעה|השעה|הוא בשעה|היא בשעה|מיקום|במקום|הערות)/iu;

/** Adding info to an existing appointment (not "תוסיף תור" = new booking). */
const ADD_TO_EXISTING_RE =
  /(?:תוסיף|תוסיפי|גם|בנוסף)(?!\s+תור\b)/iu;

const NOTES_UPDATE_RE =
  /(הערה|הערות|תוסיף להערות|תוסיפי להערות|להוסיף להערות|שימו לב|לזכור|להביא|צריך להביא)/iu;

export function looksLikeAddingToExisting(payload: string): boolean {
  if (looksLikeNewAppointment(payload)) {
    return false;
  }
  return looksLikeNotesUpdate(payload) || ADD_TO_EXISTING_RE.test(payload);
}

export function looksLikeNewAppointment(payload: string): boolean {
  return NEW_APPOINTMENT_RE.test(payload);
}

/** User is adding or changing prep notes. */
export function looksLikeNotesUpdate(payload: string): boolean {
  if (looksLikeNewAppointment(payload)) {
    return false;
  }
  return NOTES_UPDATE_RE.test(payload);
}

/** User is only changing schedule (date/time) or picking which appointment — not notes. */
export function looksLikeScheduleOnlyUpdate(payload: string): boolean {
  if (looksLikeNotesUpdate(payload)) {
    return false;
  }
  return (
    looksLikeAppointmentUpdate(payload) &&
    (textHasExplicitTime(payload) ||
      DATE_HINT_RE.test(payload) ||
      UPDATE_RE.test(payload))
  );
}

/** Follow-up edits to an appointment that is already in the system. */
export function looksLikeAppointmentUpdate(payload: string): boolean {
  if (looksLikeNewAppointment(payload)) {
    return false;
  }
  if (UPDATE_RE.test(payload)) {
    return true;
  }
  if (ADD_TO_EXISTING_RE.test(payload)) {
    return true;
  }
  if (DATE_HINT_RE.test(payload) && /(?:תור|התור)\s+של/iu.test(payload)) {
    return true;
  }
  if (EXISTING_APPOINTMENT_RE.test(payload) && FIELD_UPDATE_RE.test(payload)) {
    return true;
  }
  if (
    !DATE_HINT_RE.test(payload) &&
    textHasExplicitTime(payload) &&
    (EXISTING_APPOINTMENT_RE.test(payload) || CLINIC_OR_SITE_RE.test(payload))
  ) {
    return true;
  }
  return false;
}

/**
 * Route explicit calendar actions (cancel / book / edit). Everything else —
 * questions, follow-ups, corrections, clarifications — is conversational Q&A
 * (history + FACTS + LLM).
 */
export function classifyWakePayload(payload: string): WakeIntent {
  if (!payload) {
    return 'list';
  }
  if (CANCEL_RE.test(payload)) {
    return 'cancel';
  }
  if (looksLikeNewAppointment(payload)) {
    return 'create';
  }
  if (looksLikeAppointmentUpdate(payload)) {
    return 'update';
  }
  if (DATE_HINT_RE.test(payload)) {
    return 'create';
  }
  return 'question';
}
