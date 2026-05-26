export const JERUSALEM_TZ = 'Asia/Jerusalem';

export type ParsedAppointmentWhen = {
  dateTime: string;
  hasTime: boolean;
};

type JerusalemParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function getJerusalemParts(date: Date): JerusalemParts {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: JERUSALEM_TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const map: Partial<JerusalemParts> = {};
  for (const p of fmt.formatToParts(date)) {
    if (
      p.type === 'year' ||
      p.type === 'month' ||
      p.type === 'day' ||
      p.type === 'hour' ||
      p.type === 'minute'
    ) {
      map[p.type] = parseInt(p.value, 10);
    }
  }
  return {
    year: map.year!,
    month: map.month!,
    day: map.day!,
    hour: map.hour ?? 0,
    minute: map.minute ?? 0,
  };
}

function compareJerusalemParts(a: JerusalemParts, b: JerusalemParts): number {
  for (const k of ['year', 'month', 'day', 'hour', 'minute'] as const) {
    if (a[k] !== b[k]) {
      return a[k] - b[k];
    }
  }
  return 0;
}

/** UTC instant for a wall-clock time in Asia/Jerusalem. */
export function jerusalemLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const target: JerusalemParts = { year, month, day, hour, minute };
  let low = Date.UTC(year, month - 2, day, 0, 0);
  let high = Date.UTC(year, month, day + 1, 23, 59);
  for (let i = 0; i < 64; i++) {
    const mid = Math.floor((low + high) / 2);
    const parts = getJerusalemParts(new Date(mid));
    const cmp = compareJerusalemParts(parts, target);
    if (cmp === 0) {
      return new Date(mid);
    }
    if (cmp < 0) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return new Date(Date.UTC(year, month - 1, day, hour - 3, minute));
}

const DATE_RE = /(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?/gu;

function expandYear(yearRaw: string): number {
  const y = parseInt(yearRaw, 10);
  if (yearRaw.length <= 2) {
    return y >= 70 ? 1900 + y : 2000 + y;
  }
  return y;
}

function resolveYear(
  day: number,
  month: number,
  yearRaw: string | undefined,
  now: Date,
): number {
  if (yearRaw) {
    return expandYear(yearRaw);
  }
  const nowJ = getJerusalemParts(now);
  let year = nowJ.year;
  const candidateDay: JerusalemParts = {
    year,
    month,
    day,
    hour: 0,
    minute: 0,
  };
  const today: JerusalemParts = {
    year: nowJ.year,
    month: nowJ.month,
    day: nowJ.day,
    hour: 0,
    minute: 0,
  };
  if (compareJerusalemParts(candidateDay, today) < 0) {
    year += 1;
  }
  return year;
}

export function textHasExplicitTime(text: string): boolean {
  return extractTimeFromText(text) !== null;
}

/** Parse compact times: 1345 → 13:45, 930 → 9:30. */
export function parseCompactTimeDigits(
  digits: string,
): { hour: number; minute: number } | null {
  const d = digits.replace(/\D/g, '');
  if (d.length === 4) {
    const hour = parseInt(d.slice(0, 2), 10);
    const minute = parseInt(d.slice(2, 4), 10);
    if (hour <= 23 && minute <= 59) {
      return { hour, minute };
    }
  }
  if (d.length === 3) {
    const hour = parseInt(d.slice(0, 1), 10);
    const minute = parseInt(d.slice(1, 3), 10);
    if (hour <= 9 && minute <= 59) {
      return { hour, minute };
    }
  }
  return null;
}

export function extractTimeFromText(
  text: string,
): { hour: number; minute: number } | null {
  const compactAfterHour = /(?:בשעה|שעה)\s*(\d{3,4})(?!\d)/giu;
  let compactMatch: RegExpExecArray | null;
  while ((compactMatch = compactAfterHour.exec(text)) !== null) {
    const parsed = parseCompactTimeDigits(compactMatch[1]);
    if (parsed) {
      return parsed;
    }
  }

  const patterns: RegExp[] = [
    /(\d{1,2}):(\d{2})/u,
    /(?:הוא|היא|זה|זו)\s+בשעה\s*(\d{1,2})(?::(\d{2}))?(?!\d)/iu,
    /בשעה\s*(\d{1,2})(?::(\d{2}))?(?!\d)/iu,
    /(?:תשנה|שנה|לעדכן|עדכן)[^.]{0,40}?ל[-–]?(\d{1,2})(?::(\d{2}))?(?!\d)/iu,
    /(?:^|[\s,])ל[-–](\d{1,2})(?::(\d{2}))?(?!\d)/iu,
  ];

  let last: { hour: number; minute: number } | null = null;
  for (const re of patterns) {
    const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
    const global = new RegExp(re.source, flags);
    let m: RegExpExecArray | null;
    while ((m = global.exec(text)) !== null) {
      const before = text.slice(Math.max(0, m.index - 3), m.index);
      if (re.source.includes(':') && /\d[./-]\d$/.test(before)) {
        continue;
      }
      const hour = parseInt(m[1], 10);
      const minute = m[2] !== undefined ? parseInt(m[2], 10) : 0;
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        if (!(hour > 23) && !(re.source.startsWith('(\\d') && hour > 31)) {
          last = { hour, minute };
        }
      }
    }
  }
  return last;
}

/** Parse one D.M / D.M.Y occurrence (same year rules as {@link parseAppointmentWhenFromText}). */
export function parseAppointmentWhenFromMatch(
  day: number,
  month: number,
  yearRaw: string | undefined,
  text: string,
  now = new Date(),
): ParsedAppointmentWhen {
  const year = resolveYear(day, month, yearRaw, now);
  const time = extractTimeFromText(text);
  const hasTime = time !== null;
  const hour = hasTime ? time!.hour : 12;
  const minute = hasTime ? time!.minute : 0;
  const utc = jerusalemLocalToUtc(year, month, day, hour, minute);
  return { dateTime: utc.toISOString(), hasTime };
}

/** Parse the last D.M / D.M.Y date in Hebrew free text; infer year from "now" in Jerusalem. */
export function parseAppointmentWhenFromText(
  text: string,
  now = new Date(),
): ParsedAppointmentWhen | null {
  const matches: Array<{
    day: number;
    month: number;
    yearRaw?: string;
  }> = [];
  for (const m of text.matchAll(DATE_RE)) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const yearRaw = m[3];
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      matches.push({ day, month, yearRaw });
    }
  }
  if (matches.length === 0) {
    return null;
  }

  const { day, month, yearRaw } = matches[matches.length - 1];
  return parseAppointmentWhenFromMatch(day, month, yearRaw, text, now);
}

/** Set wall-clock time on the same Jerusalem calendar day as an existing appointment. */
export function applyTimeToAppointmentDay(
  existingDateTime: Date,
  text: string,
): ParsedAppointmentWhen | null {
  const time = extractTimeFromText(text);
  if (!time) {
    return null;
  }
  const parts = getJerusalemParts(existingDateTime);
  const utc = jerusalemLocalToUtc(
    parts.year,
    parts.month,
    parts.day,
    time.hour,
    time.minute,
  );
  return { dateTime: utc.toISOString(), hasTime: true };
}

/** All calendar dates mentioned in text (for matching an existing appointment on update). */
export function listDateMatchesInText(text: string): Array<{
  day: number;
  month: number;
  yearRaw?: string;
}> {
  const matches: Array<{ day: number; month: number; yearRaw?: string }> = [];
  for (const m of text.matchAll(DATE_RE)) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const yearRaw = m[3];
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      matches.push({ day, month, yearRaw });
    }
  }
  return matches;
}

export function formatAppointmentWhenHebrew(
  iso: string | Date,
  hasTime: boolean,
): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (hasTime) {
    return d.toLocaleString('he-IL', {
      timeZone: JERUSALEM_TZ,
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }
  return d.toLocaleDateString('he-IL', {
    timeZone: JERUSALEM_TZ,
    dateStyle: 'short',
  });
}

/** Midnight Jerusalem → next midnight (for DB day queries). */
export function jerusalemCalendarDayRange(day: Date): { start: Date; end: Date } {
  const { year, month, day: d } = getJerusalemParts(day);
  const start = jerusalemLocalToUtc(year, month, d, 0, 0);
  let nextMonth = month;
  let nextDay = d + 1;
  let nextYear = year;
  const daysInMonth = new Date(year, month, 0).getDate();
  if (nextDay > daysInMonth) {
    nextDay = 1;
    nextMonth += 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
  }
  const end = jerusalemLocalToUtc(nextYear, nextMonth, nextDay, 0, 0);
  return { start, end };
}
