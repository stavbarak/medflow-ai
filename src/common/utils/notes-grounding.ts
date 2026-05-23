/** Terms that indicate transport — must appear in the user's message too. */
const TRANSPORT_RE =
  /מכונית|רכב|הגעה|מונית|נהג|נסיעה|הסעה|יסיע|תסיע|יגיע|מגיע/iu;

function significantWords(sentence: string): string[] {
  return sentence
    .split(/[\s,.:;]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);
}

/**
 * True if this sentence is supported by words in the user's message.
 * Drops common hallucinations (e.g. private car when user never mentioned transport).
 */
export function sentenceGroundedInSource(
  sentence: string,
  sourceText: string,
): boolean {
  const s = sentence.trim();
  if (!s) {
    return false;
  }
  if (TRANSPORT_RE.test(s) && !TRANSPORT_RE.test(sourceText)) {
    return false;
  }
  const words = significantWords(s);
  if (words.length === 0) {
    return false;
  }
  let hits = 0;
  for (const w of words) {
    if (sourceText.includes(w)) {
      hits++;
    }
  }
  const threshold = Math.max(1, Math.ceil(words.length * 0.35));
  return hits >= threshold;
}

function splitNoteSentences(notes: string): string[] {
  return notes
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/u))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Keep only note sentences that appear grounded in the original user message. */
export function filterNotesToSourceText(
  notes: string,
  sourceText: string,
): string {
  const sentences = splitNoteSentences(notes);
  const kept = sentences.filter((s) => sentenceGroundedInSource(s, sourceText));
  return kept.join('\n').trim();
}

/** After AI merge: keep existing lines; new lines must be grounded in the latest message. */
export function filterMergedNotes(
  existingNotes: string,
  mergedNotes: string,
  userMessage: string,
): string {
  const existing = existingNotes.trim();
  const sentences = splitNoteSentences(mergedNotes);
  const kept: string[] = [];
  for (const s of sentences) {
    if (existing && existing.includes(s)) {
      kept.push(s);
      continue;
    }
    if (sentenceGroundedInSource(s, userMessage)) {
      kept.push(s);
    }
  }
  const result = kept.join('\n').trim();
  return result || existing;
}
