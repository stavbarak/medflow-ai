import { BOT_WAKE_WORD } from './question-heuristic';

const LEADING_PADDING_RE = /^[\s,;:!?.\-–—…\u05BE]+/gu;
const PUNCTUATION_ONLY_RE = /^[\s,;:!?.\-–—…\u05BE]+$/u;

/** Greeting-only remainder after the wake word → treat like bare wake word (list). */
const GREETING_ONLY_RE =
  /^(?:שלום|היי|hey|hi|hello|בוקר\s+טוב|ערב\s+טוב|לילה\s+טוב|שבוע\s+טוב|מה\s+נשמע|מה\s+שלומ(?:ך|ם))[\s!?.,…]*$/iu;

const LEADING_GREETING_RE =
  /^(?:שלום|היי|hey|hi|hello|בוקר\s+טוב|ערב\s+טוב|לילה\s+טוב|שבוע\s+טוב)[\s,;:!?.\-–—…\u05BE]+/iu;

export function containsWakeWord(text: string): boolean {
  return text.includes(BOT_WAKE_WORD);
}

/** Remove wake word and non-substantive tail (punctuation, greetings only). */
export function stripWakeWord(text: string): string {
  let rest = text.replace(new RegExp(BOT_WAKE_WORD, 'g'), '').trim();
  if (PUNCTUATION_ONLY_RE.test(rest)) {
    return '';
  }
  rest = rest.replace(LEADING_PADDING_RE, '').trim();
  rest = rest.replace(LEADING_GREETING_RE, '').trim();
  if (!rest || GREETING_ONLY_RE.test(rest)) {
    return '';
  }
  return rest;
}
