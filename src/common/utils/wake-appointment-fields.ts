/** Helpers for appointment text — no hardcoded hospital lists. */

export function isPlaceholderTitle(title: string | undefined | null): boolean {
  const t = title?.trim() ?? '';
  return !t || t === 'תור' || t.length < 3;
}

export function isPlaceholderLocation(location: string | undefined | null): boolean {
  const l = location?.trim() ?? '';
  return !l || l === 'ייקבע' || l === 'ייקבע.';
}

/** Infer visit title from natural Hebrew booking phrases. */
export function inferTitleFromText(text: string): string | undefined {
  const patterns = [
    /(?:תמחק|מחק|בטל|תבטל)\s+תור\s+ל?([א-ת][א-ת\s'-]+?)(?:\s+ב\s*[-.\d]|\s+בשעה)/iu,
    /(?:תוסיף|תוסיפי|הוסף|יש)\s+(?:ל)?(?:אבא\s+)?תור\s+(.+?)\s+בא[א-ת]/iu,
    /(?:תוסיף|תוסיפי|הוסף|יש)\s+(?:ל)?(?:אבא\s+)?תור\s+(.+?)(?:\s+ב[-\d]|\s+בשעה)/iu,
    /ביקורת\s+([א-ת][א-ת\s]+?)(?:\s+ב|\s+בא|$)/iu,
    /עירוי\s+([א-ת][א-ת\s]+?)(?:\s+ב|\s+בא|$)/iu,
    /(?:ה)?תור\s+(?:הוא\s+)?ל([^.,\d]+?)(?:\s+ב[-\d]|\s+בא|$)/iu,
    /(?:ש)?ה?תור\s+ל([^.,\d]+?)(?:\s+ב[-\d]|\s+הוא)/iu,
    /הוא\s+ל([א-ת][א-ת\s]+?)(?:\s+בא[א-ת]|\s+ב[א-ת]|\s*$)/iu,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const t = m[1]
        .replace(/\s+ב[-\d].*$/u, '')
        .replace(/\s+בשעה.*$/iu, '')
        .trim();
      if (t.length >= 3 && t !== 'אבא' && t !== 'תור') {
        return t;
      }
    }
  }
  return undefined;
}

/** Infer location: "באיכילוב", "ב-X" before a date — no fixed hospital list. */
export function inferLocationFromText(text: string): string | undefined {
  const gluedBeforeDate = text.match(/\sב([א-ת][א-ת'-]{2,})\s+ב[-\d]/iu);
  if (gluedBeforeDate?.[1]) {
    return gluedBeforeDate[1].trim();
  }
  const trailing = text.match(/\sב(איכילוב|בית\s*חולים[^\d,]+)(?:\s*$)/iu);
  if (trailing?.[1]) {
    return trailing[1].replace(/^בית\s*חולים\s*/iu, '').trim() || trailing[1].trim();
  }
  const beforeDate = text.match(/\s+ב([א-ת][א-ת\s'-]{2,}?)\s+ב[-\d]/iu);
  if (beforeDate?.[1]) {
    const loc = beforeDate[1].trim();
    if (loc.length >= 3 && !/^\d/.test(loc)) {
      return loc;
    }
  }
  return undefined;
}

export function inferWakeAppointmentFields(text: string): {
  title?: string;
  location?: string;
} {
  return {
    title: inferTitleFromText(text),
    location: inferLocationFromText(text),
  };
}

/** Subject phrases for matching which appointment to update. */
function normalizeVisitSubjectPhrase(raw: string): string {
  let t = raw.trim();
  if (t.startsWith('ל') && t.length > 3) {
    t = t.slice(1).trim();
  }
  return t;
}

export function extractSubjectHintsForMatch(text: string): string[] {
  const hints = new Set<string>();
  const title = inferTitleFromText(text);
  if (title) {
    const normalized = normalizeVisitSubjectPhrase(title);
    hints.add(normalized);
    for (const w of normalized.split(/\s+/)) {
      if (w.length >= 4) {
        hints.add(w);
      }
    }
  }
  return [...hints];
}

/** Stored time is our "date only" noon anchor (Asia/Jerusalem). */
export function isLikelyDateOnlyTime(dateTime: Date): boolean {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(dateTime).map((p) => [p.type, p.value]),
  );
  return parts.hour === '12' && parts.minute === '0';
}
