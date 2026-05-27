import { buildAppointmentIcs } from './appointment-ics';
import { jerusalemLocalToUtc } from './appointment-datetime';

describe('buildAppointmentIcs', () => {
  it('builds a timed event with UTC DTSTART/DTEND', () => {
    const start = new Date('2026-08-01T10:00:00.000Z');
    const ics = buildAppointmentIcs({
      uid: 'abc',
      title: 'תור',
      start,
      hasTime: true,
      durationMinutes: 60,
      location: 'איכילוב',
      description: 'בדיקה',
    });
    expect(ics).toContain('BEGIN:VCALENDAR\r\n');
    expect(ics).toContain('BEGIN:VEVENT\r\n');
    expect(ics).toContain('DTSTART:20260801T100000Z\r\n');
    expect(ics).toContain('DTEND:20260801T110000Z\r\n');
    expect(ics).toContain('LOCATION:איכילוב\r\n');
    expect(ics).toContain('DESCRIPTION:בדיקה\r\n');
    expect(ics).toContain('END:VEVENT\r\nEND:VCALENDAR\r\n');
  });

  it('builds an all-day event in Jerusalem dates', () => {
    const start = jerusalemLocalToUtc(2026, 8, 1, 12, 0);
    const ics = buildAppointmentIcs({
      uid: 'xyz',
      title: 'תור',
      start,
      hasTime: false,
    });
    expect(ics).toContain('DTSTART;VALUE=DATE:20260801\r\n');
    expect(ics).toContain('DTEND;VALUE=DATE:20260802\r\n');
  });

  it('escapes newlines and commas', () => {
    const start = new Date('2026-08-01T10:00:00.000Z');
    const ics = buildAppointmentIcs({
      uid: 'abc',
      title: 'תור, בדיקה',
      start,
      hasTime: true,
      description: 'שורה 1\nשורה 2',
    });
    expect(ics).toContain('SUMMARY:תור\\, בדיקה\r\n');
    expect(ics).toContain('DESCRIPTION:שורה 1\\nשורה 2\r\n');
  });
});

