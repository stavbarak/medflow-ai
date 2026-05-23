import { buildAdditiveUpdatePatch } from './appointment-update-patch';

describe('buildAdditiveUpdatePatch', () => {
  const target = {
    dateTime: new Date('2026-07-30T09:00:00.000Z'),
    title: 'ביקורת קרדיו',
    location: 'איכילוב',
    notes: 'עדי תהיה איתו',
  };

  it('only changes time when requested', () => {
    const { patch } = buildAdditiveUpdatePatch(
      'תעדכן שהתור ב-30.7 הוא בשעה 9:30',
      target,
      { wantsTimeChange: true },
    );
    expect(patch.dateTime).toBeDefined();
    expect(patch.notes).toBeUndefined();
    expect(patch.title).toBeUndefined();
    expect(patch.location).toBeUndefined();
  });
});
