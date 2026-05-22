import {
  BOT_WAKE_WORD,
  looksLikeQuestion,
} from '../common/utils/question-heuristic';
import { textHasExplicitTime } from '../common/utils/appointment-datetime';

export type WakeIntent = 'list' | 'question' | 'create' | 'cancel' | 'update';

export function stripWakeWord(text: string): string {
  return text.replace(new RegExp(BOT_WAKE_WORD, 'g'), '').trim();
}

const CANCEL_RE =
  /(תבטל|תבטלי|בטל|בטלי|מחק|מחקי|ביטול|לבטל|להסיר|הסר|cancel)/iu;

const UPDATE_RE =
  /(התבלבל|תתקן|תתקני|תשנה|תשני|תעדכן|עדכן|תקן|תקני|לא נכון|תיקון|לתקן|לשנות|לעדכן|שנה את|שני את)/iu;

const NEW_APPOINTMENT_RE =
  /(יש תור|תור חדש|לקבוע|לתאם|הוסף תור|נוסף תור|נקבע תור)/iu;

const DATE_HINT_RE = /\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?/u;

/** Refers to an appointment that already exists (not booking a new one). */
const EXISTING_APPOINTMENT_RE =
  /(?:^|[,\s])(?:ה)?תור\s+(?:ב|במ|ב-|ל|של|הוא|היא)|התור\s+(?:הוא|היא|בשעה|ב-|במ)/iu;

const CLINIC_OR_SITE_RE =
  /(מרפאה|איכילוב|בית חולים|בית-חולים|מכון|קופת|הדסה|שיבא|סורוקה|אסף|רמבם)/iu;

const FIELD_UPDATE_RE =
  /(בשעה|השעה|הוא בשעה|היא בשעה|מיקום|במקום|הערות|מונית|מלווה|ילווה|מגיע)/iu;

/** Follow-up edits: add time/notes to an existing appointment without repeating the date. */
export function looksLikeAppointmentUpdate(payload: string): boolean {
  if (UPDATE_RE.test(payload)) {
    return true;
  }
  if (NEW_APPOINTMENT_RE.test(payload)) {
    return false;
  }
  if (DATE_HINT_RE.test(payload) && UPDATE_RE.test(payload)) {
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

/** Classify text after removing the wake word. */
export function classifyWakePayload(payload: string): WakeIntent {
  if (!payload) {
    return 'list';
  }
  if (CANCEL_RE.test(payload)) {
    return 'cancel';
  }
  if (looksLikeAppointmentUpdate(payload)) {
    return 'update';
  }
  if (looksLikeQuestion(payload)) {
    return 'question';
  }
  if (NEW_APPOINTMENT_RE.test(payload) || DATE_HINT_RE.test(payload)) {
    return 'create';
  }
  return 'question';
}
