import { getJerusalemParts, JERUSALEM_TZ } from './appointment-datetime';

export type AppointmentIcsInput = {
  uid: string;
  title: string;
  start: Date;
  hasTime: boolean;
  location?: string | null;
  description?: string | null;
  /** Timed events only. Defaults to 60 minutes. */
  durationMinutes?: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function formatUtcDateTime(date: Date): string {
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

function formatJerusalemDate(date: Date): string {
  const p = getJerusalemParts(date);
  return String(p.year) + pad2(p.month) + pad2(p.day);
}

function addJerusalemDays(date: Date, days: number): string {
  const p = getJerusalemParts(date);
  // Use noon UTC as a stable anchor (date-only output).
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days, 12, 0, 0));
  return formatJerusalemDate(d);
}

/**
 * Build an ICS payload. This is intended to be served with:
 * - Content-Type: text/calendar; charset=utf-8
 * - Content-Disposition: attachment; filename="appointment.ics"
 */
export function buildAppointmentIcs(input: AppointmentIcsInput): string {
  const lines: string[] = [];
  const title = (input.title || 'תור').trim();
  const uid = `${input.uid}@medflow`;
  const dtstamp = formatUtcDateTime(new Date());
  const location = (input.location ?? '').trim();
  const description = (input.description ?? '').trim();

  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//MedFlowAI//Appointments//HE');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  lines.push('BEGIN:VEVENT');
  lines.push(`UID:${escapeIcsText(uid)}`);
  lines.push(`DTSTAMP:${dtstamp}`);
  lines.push(`SUMMARY:${escapeIcsText(title)}`);

  if (input.hasTime) {
    const durationMinutes = Math.max(5, input.durationMinutes ?? 60);
    const start = input.start;
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    lines.push(`DTSTART:${formatUtcDateTime(start)}`);
    lines.push(`DTEND:${formatUtcDateTime(end)}`);
  } else {
    // All-day event in Jerusalem calendar dates. End is exclusive (next day).
    const startYmd = formatJerusalemDate(input.start);
    const endYmd = addJerusalemDays(input.start, 1);
    lines.push(`DTSTART;VALUE=DATE:${startYmd}`);
    lines.push(`DTEND;VALUE=DATE:${endYmd}`);
    // Keep timezone hint for clients; harmless for VALUE=DATE.
    lines.push(`X-WR-TIMEZONE:${JERUSALEM_TZ}`);
  }

  if (location) {
    lines.push(`LOCATION:${escapeIcsText(location)}`);
  }
  if (description) {
    lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
  }

  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  // RFC requires CRLF.
  return lines.join('\r\n') + '\r\n';
}

