/** Rough heuristic: treat as question vs new appointment info (WhatsApp). */
export function looksLikeQuestion(text: string): boolean {
  const t = text.trim();
  if (!t) {
    return false;
  }
  if (t.endsWith('?')) {
    return true;
  }
  const prefixes =
    /^(מה|איפה|מתי|מי|למה|איך|כמה|האם|יש|נשאר|צריך|באיזה|איזה|היכן)/u;
  return prefixes.test(t);
}
