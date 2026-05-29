/**
 * Heuristics that decide how much data the Q&A facts payload should include.
 *
 * The bot answers questions from a JSON "facts" payload. Upcoming appointments are
 * always loaded; past appointments + keyword stats are only worth loading when the
 * question implies history, counting, prep, or a specific treatment/test.
 */

/** Past/"so far" markers (e.g. "כמה היו עד היום", "כבר", "בעבר"). */
export function isPastOrSoFarQuestion(question: string): boolean {
  return /(עד\s*היום|עד\s*כה|עד\s*עכשיו|עד\s*כאן|היה|כבר|בעבר|פעם|מה\s+היה|כמה\s+היו)/iu.test(
    question,
  );
}

/** Counting questions ("כמה ..."). */
export function isCountQuestion(question: string): boolean {
  return /(?<![א-ת])כמה(?![א-ת])/u.test(question);
}

/** Preparation questions ("מה צריך", "לפני", "להביא", "לדעת", "הכנה"). */
export function isPrepQuestion(question: string): boolean {
  return /(מה\s+צריך|לפני|להביא|לדעת|הכנה|להכין)/u.test(question);
}

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

/**
 * Whether the Q&A payload should include past appointments + keyword stats
 * (anything beyond plain upcoming appointments).
 */
export function needsExpandedFacts(question: string): boolean {
  return (
    isPastOrSoFarQuestion(question) ||
    isCountQuestion(question) ||
    isPrepQuestion(question) ||
    extractTreatmentKeyword(question) != null
  );
}
