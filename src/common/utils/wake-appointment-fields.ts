/** Helpers for matching updates — not for overwriting stored appointment data. */

export function isPlaceholderTitle(title: string | undefined | null): boolean {
  const t = title?.trim() ?? '';
  return !t || t === 'תור' || t.length < 3;
}

export function isPlaceholderLocation(location: string | undefined | null): boolean {
  const l = location?.trim() ?? '';
  return !l || l === 'ייקבע' || l === 'ייקבע.';
}

/** Subject phrases in update messages for disambiguation (e.g. "קרדיו אונקולוגיה"). */
export function extractSubjectHintsForMatch(text: string): string[] {
  const hints = new Set<string>();
  const m = text.match(/(?:ש)?ה?תור\s+ל([א-ת\s]+?)(?:\s+ב[-\d]|\s+הוא)/iu);
  if (m?.[1]) {
    const phrase = m[1].trim();
    if (phrase.length >= 4) {
      hints.add(phrase);
      for (const w of phrase.split(/\s+/)) {
        if (w.length >= 4) {
          hints.add(w);
        }
      }
    }
  }
  const visit = text.match(/ביקורת\s+([א-ת\s]+?)(?:\s+ב[-\d]|\s+בשעה)/iu);
  if (visit?.[1]) {
    const phrase = visit[1].trim();
    if (phrase.length >= 4) {
      hints.add(phrase);
    }
  }
  return [...hints];
}
