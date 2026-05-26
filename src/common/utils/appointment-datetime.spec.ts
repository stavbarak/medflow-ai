import {
  extractTimeFromText,
  formatAppointmentWhenHebrew,
  getJerusalemParts,
  listDateMatchesInText,
  parseAppointmentWhenFromText,
  parseCompactTimeDigits,
  textHasExplicitTime,
} from './appointment-datetime';

const MAY_20_2026 = new Date('2026-05-20T09:00:00.000Z');

describe('parseAppointmentWhenFromText', () => {
  it('parses 25.5 as May 25 in the current Jerusalem year', () => {
    const r = parseAppointmentWhenFromText(
      'לאבא יש תור במרפאה הפליאטיבית ביום שני ה-25.5',
      MAY_20_2026,
    );
    expect(r).not.toBeNull();
    const parts = getJerusalemParts(new Date(r!.dateTime));
    expect(parts.day).toBe(25);
    expect(parts.month).toBe(5);
    expect(parts.year).toBe(2026);
    expect(r!.hasTime).toBe(false);
  });

  it('does not invent a time when none was given', () => {
    const r = parseAppointmentWhenFromText('תור ב-25.5', MAY_20_2026);
    expect(r!.hasTime).toBe(false);
    expect(textHasExplicitTime('תור ב-25.5')).toBe(false);
  });

  it('parses explicit 25.5.2026 and 11:00', () => {
    const r = parseAppointmentWhenFromText(
      'זה 25.5.2026 ותשנה את זה ל-11:00',
      MAY_20_2026,
    );
    expect(r!.hasTime).toBe(true);
    const parts = getJerusalemParts(new Date(r!.dateTime));
    expect(parts.day).toBe(25);
    expect(parts.month).toBe(5);
    expect(parts.year).toBe(2026);
    expect(parts.hour).toBe(11);
    expect(parts.minute).toBe(0);
  });

  it('rolls month-only dates in the past to next year (January while in September)', () => {
    const sep = new Date('2026-09-15T09:00:00.000Z');
    const r = parseAppointmentWhenFromText('תור ב-15.1', sep);
    const parts = getJerusalemParts(new Date(r!.dateTime));
    expect(parts.year).toBe(2027);
    expect(parts.month).toBe(1);
    expect(parts.day).toBe(15);
  });

  it('parses hyphen-separated dates like 14-7', () => {
    const r = parseAppointmentWhenFromText(
      'תעדכן שבתור ב 14-7 בסוף שגיא יסיע',
      MAY_20_2026,
    );
    expect(r).not.toBeNull();
    const parts = getJerusalemParts(new Date(r!.dateTime));
    expect(parts.day).toBe(14);
    expect(parts.month).toBe(7);
    expect(parts.year).toBe(2026);
  });
});

describe('listDateMatchesInText', () => {
  it('finds 14-7 for transport update messages', () => {
    expect(
      listDateMatchesInText(
        'תעדכן שבתור ב 14-7 בסוף שגיא יסיע ולא שירי',
      ),
    ).toEqual([{ day: 14, month: 7, yearRaw: undefined }]);
  });
});

describe('extractTimeFromText', () => {
  it('parses compact HHMM after בשעה (1345 → 13:45)', () => {
    const t = extractTimeFromText('תוסיף תור לאונקולוג ב 5.8 בשעה 1345');
    expect(t).toEqual({ hour: 13, minute: 45 });
  });

  it('parses 930 as 9:30', () => {
    expect(parseCompactTimeDigits('930')).toEqual({ hour: 9, minute: 30 });
    expect(extractTimeFromText('בשעה 930')).toEqual({ hour: 9, minute: 30 });
  });

  it('still parses 12:00 colon format', () => {
    expect(extractTimeFromText('בשעה 12:00')).toEqual({ hour: 12, minute: 0 });
  });

  it('stores 13:45 when creating via parseAppointmentWhenFromText', () => {
    const r = parseAppointmentWhenFromText(
      'חנטריש תוסיף תור לאונקולוג ב 5.8 בשעה 1345',
      MAY_20_2026,
    );
    expect(r!.hasTime).toBe(true);
    const parts = getJerusalemParts(new Date(r!.dateTime));
    expect(parts.hour).toBe(13);
    expect(parts.minute).toBe(45);
  });
});

describe('formatAppointmentWhenHebrew', () => {
  it('shows time only when hasTime is true', () => {
    const iso = parseAppointmentWhenFromText(
      '25.5.2026 ל-11:00',
      MAY_20_2026,
    )!.dateTime;
    const withTime = formatAppointmentWhenHebrew(iso, true);
    const dateOnly = formatAppointmentWhenHebrew(iso, false);
    expect(withTime).toMatch(/11/);
    expect(dateOnly).not.toMatch(/11:00|11:0/);
  });
});
