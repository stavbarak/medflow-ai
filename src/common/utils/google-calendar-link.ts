import { JERUSALEM_TZ, getJerusalemParts } from './appointment-datetime';

/** Hebrew label for WhatsApp “add to calendar” line (URL follows on same line). */
export const CALENDAR_SAVE_LABEL = 'קישור לשמירה ביומן';

/** Hebrew label when an appointment was cancelled — opens that day in Google Calendar. */
export const CALENDAR_REMOVE_LABEL = 'קישור ליומן להסרה ידנית';

export function formatCalendarActionLine(label: string, url: string): string {
  return `\n${label}: ${url}`;
}

export type GoogleCalendarTemplateInput = {
  title: string;
  startDate: Date;
  hasTime: boolean;
  location?: string | null;
  details?: string | null;
  /** Timed events only. Defaults to 60 minutes. */
  durationMinutes?: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatUtcForGoogle(date: Date): string {
  // YYYYMMDDTHHMMSSZ (UTC)
  return (
    String(date.getUTCFullYear()) +
    pad2(date.getUTCMonth() + 1) +
    pad2(date.getUTCDate()) +
    'T' +
    pad2(date.getUTCHours()) +
    pad2(date.getUTCMinutes()) +
    pad2(date.getUTCSeconds()) +
    'Z'
  );
}

function formatJerusalemYmd(date: Date): string {
  const p = getJerusalemParts(date);
  return String(p.year) + pad2(p.month) + pad2(p.day);
}

function addJerusalemDays(date: Date, days: number): Date {
  // Use the UTC instant and only operate on the Jerusalem calendar parts to avoid DST pitfalls.
  const p = getJerusalemParts(date);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days, 12, 0, 0));
  // We only need the date parts, so using noon UTC as a stable anchor is fine.
  return d;
}

export function buildGoogleCalendarTemplateUrl(
  input: GoogleCalendarTemplateInput,
): string {
  const base = 'https://calendar.google.com/calendar/render';
  const title = (input.title || 'תור').trim();
  const location = (input.location ?? '').trim();
  const details = (input.details ?? '').trim();
  const ctz = JERUSALEM_TZ;

  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('ctz', ctz);
  params.set('text', title);
  if (location) {
    params.set('location', location);
  }
  if (details) {
    params.set('details', details);
  }

  if (input.hasTime) {
    const durationMinutes = Math.max(5, input.durationMinutes ?? 60);
    const start = input.startDate;
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    params.set(
      'dates',
      `${formatUtcForGoogle(start)}/${formatUtcForGoogle(end)}`,
    );
  } else {
    // All-day event in Jerusalem calendar dates. End is exclusive (next day).
    const startYmd = formatJerusalemYmd(input.startDate);
    const endYmd = formatJerusalemYmd(addJerusalemDays(input.startDate, 1));
    params.set('dates', `${startYmd}/${endYmd}`);
  }

  return `${base}?${params.toString()}`;
}

/** Opens Google Calendar on the appointment day (user deletes the event manually). */
export function buildGoogleCalendarDayViewUrl(date: Date): string {
  const { year, month, day } = getJerusalemParts(date);
  const params = new URLSearchParams({ ctz: JERUSALEM_TZ });
  return `https://calendar.google.com/calendar/r/day/${year}/${month}/${day}?${params.toString()}`;
}
