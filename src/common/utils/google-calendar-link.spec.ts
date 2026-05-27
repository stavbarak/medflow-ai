import {
  buildGoogleCalendarDayViewUrl,
  buildGoogleCalendarTemplateUrl,
  CALENDAR_REMOVE_LABEL,
  CALENDAR_SAVE_LABEL,
  formatCalendarActionLine,
} from './google-calendar-link';
import { jerusalemLocalToUtc } from './appointment-datetime';

describe('buildGoogleCalendarTemplateUrl', () => {
  it('creates a timed event URL with encoded fields', () => {
    const start = new Date('2026-08-05T09:45:00.000Z');
    const url = buildGoogleCalendarTemplateUrl({
      title: 'בדיקה אונקולוגית',
      startDate: start,
      hasTime: true,
      location: 'איכילוב',
      details: 'להביא מסמכים',
      durationMinutes: 60,
    });

    expect(url).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE');
    expect(url).toContain('ctz=Asia%2FJerusalem');
    expect(url).toContain('text=%D7%91%D7%93%D7%99%D7%A7%D7%94');
    expect(url).toContain('location=%D7%90%D7%99%D7%9B%D7%99%D7%9C%D7%95%D7%91');
    expect(url).toContain('details=%D7%9C%D7%94%D7%91%D7%99%D7%90');
    expect(url).toContain('dates=20260805T094500Z%2F20260805T104500Z');
  });

  it('creates an all-day event URL using Jerusalem calendar dates', () => {
    const start = jerusalemLocalToUtc(2026, 8, 5, 12, 0);
    const url = buildGoogleCalendarTemplateUrl({
      title: 'תור',
      startDate: start,
      hasTime: false,
      location: 'ייקבע',
    });
    // 5 Aug → 6 Aug, end is exclusive
    expect(url).toContain('dates=20260805%2F20260806');
  });

  it('formats Hebrew calendar action lines for WhatsApp', () => {
    expect(formatCalendarActionLine(CALENDAR_SAVE_LABEL, 'https://example.com')).toBe(
      '\nשמירה ביומן: https://example.com',
    );
    expect(formatCalendarActionLine(CALENDAR_REMOVE_LABEL, 'https://example.com')).toBe(
      '\nהסרה מהיומן: https://example.com',
    );
  });

  it('opens Google Calendar on the Jerusalem day for manual removal', () => {
    const start = jerusalemLocalToUtc(2026, 8, 5, 12, 0);
    expect(buildGoogleCalendarDayViewUrl(start)).toBe(
      'https://calendar.google.com/calendar/r/day/2026/8/5?ctz=Asia%2FJerusalem',
    );
  });
});

