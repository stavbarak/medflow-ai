/**
 * Best-effort treatment keyword for focused counts in the Q&A facts payload.
 */

const MULTI_WORD_TREATMENTS = ['פט סיטי', 'פט-סיטי', 'בדיקת דם'];
const SINGLE_WORD_TREATMENTS = [
  'פט',
  'קיטרודה',
  'זומרה',
  'כימותרפיה',
  'כימו',
  'הקרנות',
  'הקרנה',
  'ביופסיה',
  'אונקולוג',
  'עירוי',
  'mri',
  'ct',
];

/**
 * Best-effort extraction of a treatment/test keyword from the question so we can
 * compute focused counts. Returns the matched term as it should be searched for in
 * appointment title/notes, or null when none is recognized.
 */
export function extractTreatmentKeyword(question: string): string | null {
  const q = question.trim();
  if (!q) {
    return null;
  }
  for (const term of MULTI_WORD_TREATMENTS) {
    if (q.includes(term)) {
      return term;
    }
  }
  const iv = /עירוי(?:י)?\s+([א-ת][א-ת"'\-]{2,})/u.exec(q);
  if (iv?.[1]) {
    return iv[1].trim();
  }
  const lower = q.toLowerCase();
  for (const term of SINGLE_WORD_TREATMENTS) {
    if (lower.includes(term.toLowerCase())) {
      return term;
    }
  }
  return null;
}

/** Which precomputed bucket answers this count question — not phrasing, just arithmetic. */
export function keywordCountForQuestion(
  question: string,
  counts: {
    beforeNow: number;
    fromNowOn: number;
    throughEndOfToday: number;
    totalMatching: number;
  },
): number {
  const q = question.trim();
  if (/כולל\s*(?:ה)?יום|(?:עד\s*)?היום/u.test(q)) {
    return counts.throughEndOfToday;
  }
  if (/עוד\s|יהיו|בעתיד|נשאר/u.test(q)) {
    return counts.fromNowOn;
  }
  if (/כבר|(?<![א-ת])היו(?![א-ת])|עשה|עשו/u.test(q)) {
    return counts.beforeNow;
  }
  return counts.totalMatching;
}
