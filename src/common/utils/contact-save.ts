/**
 * Detect + parse "save this useful number" WhatsApp messages — phones, but also
 * IDs (ת"ז) and member numbers, e.g.
 *   "תשמור את המספר של ד\"ר לוי: 03-1234567"
 *   "תוסיפי טלפון של המרפאה האונקולוגית 03-6974444"
 *   "המספר של המונית הוא 052-1234567"
 *   "תשמרי את תעודת הזהות של אבא: 012345678"
 * Deterministic (regex), so saving numbers works even without the LLM.
 */

export type ParsedContactSave = { name: string; value: string };

// NOTE: no \b after Hebrew (JS word boundaries are ASCII-only) — use (?![א-ת]).
const KIND = String.raw`ה?מספר|ה?טלפון|ה?ת["׳']?ז|תעודת\s+ה?זהות`;

const SAVE_INTENT_RE = new RegExp(
  String.raw`(?:תשמור|תשמרי|שמור|שמרי|תוסיף|תוסיפי|הוסף|הוסיפי)[^.]{0,30}?(?:מספר|טלפון|ת["׳']?ז|תעודת\s+ה?זהות)|(?:${KIND})\s+של\s+.+?\s+הוא\s`,
  'iu',
);

const PHONE_RE = /(\+?\d[\d\s().*-]{5,}\d)/u;

const NAME_RE = new RegExp(
  String.raw`(${KIND})\s+(?:של\s+)?([^:,\d]+?)(?=\s*(?:[:,–-]\s*)?\+?\d|\s+הוא(?![א-ת]))`,
  'iu',
);

/** Non-phone kinds keep their descriptor in the saved name ("ת"ז של אבא"). */
const ID_KIND_RE = /ת["׳']?ז|תעודת/iu;

export function parseContactSave(text: string): ParsedContactSave | null {
  if (!SAVE_INTENT_RE.test(text)) {
    return null;
  }
  const valueMatch = text.match(PHONE_RE);
  if (!valueMatch) {
    return null;
  }
  const value = valueMatch[1].replace(/\s+/g, ' ').trim();
  if (value.replace(/\D/g, '').length < 7) {
    return null;
  }
  const nameMatch = text.match(NAME_RE);
  const subject = nameMatch?.[2]?.trim().replace(/[.,:]+$/u, '').trim();
  if (!subject || subject.length < 2) {
    return null;
  }
  const name = ID_KIND_RE.test(nameMatch![1])
    ? `ת"ז של ${subject}`
    : subject;
  return { name, value };
}
