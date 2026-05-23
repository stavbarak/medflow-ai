import {
  inferTitleFromText,
  inferWakeAppointmentFields,
} from './wake-appointment-fields';

describe('inferWakeAppointmentFields', () => {
  it('parses create message', () => {
    const f = inferWakeAppointmentFields(
      'תוסיף תור לאבא ביקורת קרדיו אונקולוגיה באיכילוב ב-30.7',
    );
    expect(f.title).toMatch(/קרדיו/);
    expect(f.location).toBe('איכילוב');
  });

  it('parses details-only update message', () => {
    const title = inferTitleFromText(
      'תעדכן שהתור ב-30.7 הוא לביקורת קרדיו אונקולוגיה באיכילוב',
    );
    expect(title).toMatch(/קרדיו/);
  });
});
