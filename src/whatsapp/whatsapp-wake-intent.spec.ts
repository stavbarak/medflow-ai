import {
  classifyWakePayload,
  looksLikeAppointmentUpdate,
  looksLikeNewAppointment,
  looksLikeNotesUpdate,
  looksLikeScheduleOnlyUpdate,
} from './whatsapp-wake-intent';

describe('classifyWakePayload', () => {
  it('detects update/correction intent before create', () => {
    expect(
      classifyWakePayload('התבלבלת בתאריך, זה 25.5.2026 ותשנה את זה ל-11:00'),
    ).toBe('update');
  });

  it('detects create for new appointment text', () => {
    expect(
      classifyWakePayload(
        'לאבא יש תור במרפאה הפליאטיבית באיכילוב ביום שני ה-25.5',
      ),
    ).toBe('create');
  });

  it('detects create for "תוסיף תור" (not update)', () => {
    const payload =
      'תוסיף תור לאבא פט סיטי ב-14.7 באיכילוב בשעה 11:00. שירי תיקח ותחזיר אותו';
    expect(looksLikeNewAppointment(payload)).toBe(true);
    expect(looksLikeAppointmentUpdate(payload)).toBe(false);
    expect(classifyWakePayload(payload)).toBe('create');
  });

  it('detects create for "יש לאבא תור ב-27.5"', () => {
    const payload =
      'יש לאבא תור ב-27.5 לעירוי קיטרודה באיכילוב בשעה 12:00. יגיע במונית וסתיו תהיה איתו שם';
    expect(looksLikeNewAppointment(payload)).toBe(true);
    expect(looksLikeAppointmentUpdate(payload)).toBe(false);
    expect(classifyWakePayload(payload)).toBe('create');
  });

  it('treats time-only follow-up as update (screenshot case)', () => {
    const payload = 'התור במרפאה הפליאטיבית הוא בשעה 11:00';
    expect(looksLikeAppointmentUpdate(payload)).toBe(true);
    expect(classifyWakePayload(payload)).toBe('update');
  });

  it('treats change-by-date as update', () => {
    const payload = 'תשנה את התור של ה-25.5 לשעה 11:00';
    expect(classifyWakePayload(payload)).toBe('update');
  });

  it('treats time change as schedule-only (not a notes edit)', () => {
    const payload = 'תשנה את התור של ה-25.5 לשעה 11:00';
    expect(looksLikeScheduleOnlyUpdate(payload)).toBe(true);
    expect(looksLikeNotesUpdate(payload)).toBe(false);
  });

  it('detects explicit notes updates', () => {
    expect(
      looksLikeNotesUpdate('תוסיף להערות שאבא יגיע במונית ועדי איתו'),
    ).toBe(true);
  });

  it('does not treat new booking notes as a notes-only update', () => {
    const payload = 'יש לאבא תור ב-27.5. יגיע במונית';
    expect(looksLikeNotesUpdate(payload)).toBe(false);
  });
});
