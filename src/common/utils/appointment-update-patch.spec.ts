import { buildSchedulePatch } from './appointment-update-patch';

describe('buildSchedulePatch', () => {
  const target = {
    dateTime: new Date('2026-07-30T06:30:00.000Z'), // 9:30 Jerusalem-ish
  };

  it('does not patch dateTime when only a date is mentioned', () => {
    const { patch, timeMentionedInMessage } = buildSchedulePatch(
      'תעדכן שהתור ב-30.7 הוא לביקורת קרדיו אונקולוגיה באיכילוב',
      target,
    );
    expect(patch.dateTime).toBeUndefined();
    expect(timeMentionedInMessage).toBe(false);
  });

  it('patches dateTime only when time is explicit', () => {
    const { patch, timeMentionedInMessage } = buildSchedulePatch(
      'תעדכן שהתור ב-30.7 הוא בשעה 9:30',
      target,
    );
    expect(patch.dateTime).toBeDefined();
    expect(timeMentionedInMessage).toBe(true);
  });
});
