import { jerusalemCalendarDayRange } from '../common/utils/appointment-datetime';

describe('keyword stats semantics', () => {
  it('throughEndOfToday includes later-today slots that beforeNow excludes', () => {
    const now = new Date('2026-06-17T10:00:00.000Z');
    const { end: endOfToday } = jerusalemCalendarDayRange(now);
    const earlierToday = new Date('2026-06-17T06:00:00.000Z');
    const laterToday = new Date('2026-06-17T14:00:00.000Z');
    const rows = [{ dateTime: earlierToday }, { dateTime: laterToday }];
    const beforeNow = rows.filter((r) => r.dateTime < now).length;
    const throughEndOfToday = rows.filter((r) => r.dateTime < endOfToday).length;
    expect(beforeNow).toBe(1);
    expect(throughEndOfToday).toBe(2);
  });
});
