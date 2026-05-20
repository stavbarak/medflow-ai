import {
  BOT_WAKE_WORD,
  looksLikeQuestion,
} from '../common/utils/question-heuristic';

export type WakeIntent = 'list' | 'question' | 'create' | 'cancel';

export function stripWakeWord(text: string): string {
  return text.replace(new RegExp(BOT_WAKE_WORD, 'g'), '').trim();
}

const CANCEL_RE =
  /(תבטל|תבטלי|בטל|בטלי|מחק|מחקי|ביטול|לבטל|להסיר|הסר|cancel)/iu;

const CREATE_RE =
  /(יש תור|תור ב|תור ל|תור ב-|נקבע|נוסף|הוסף|לקבוע|לתאם|תור חדש)/iu;

const DATE_HINT_RE = /\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?/u;

/** Classify text after removing the wake word. */
export function classifyWakePayload(payload: string): WakeIntent {
  if (!payload) {
    return 'list';
  }
  if (CANCEL_RE.test(payload)) {
    return 'cancel';
  }
  if (looksLikeQuestion(payload)) {
    return 'question';
  }
  if (CREATE_RE.test(payload) || DATE_HINT_RE.test(payload)) {
    return 'create';
  }
  return 'question';
}
