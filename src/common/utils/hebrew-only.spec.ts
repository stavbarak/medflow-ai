import { hasDisallowedLatin, stripDisallowedLatin } from './hebrew-only';

describe('hebrew-only guard', () => {
  it('flags non-Hebrew words but allows medical abbreviations', () => {
    expect(hasDisallowedLatin('איך puedo לעזור?')).toBe(true);
    expect(hasDisallowedLatin('הוספתי תור')).toBe(false);
    expect(hasDisallowedLatin('יש לך תור ל-PET CT')).toBe(false);
    expect(hasDisallowedLatin('בדיקת MRI מחר')).toBe(false);
  });

  it('strips disallowed Latin and tidies whitespace', () => {
    expect(stripDisallowedLatin('כן, אני puedo לעזור לך.')).toBe(
      'כן, אני לעזור לך.',
    );
    expect(stripDisallowedLatin('תור ל-PET CT מחר')).toBe('תור ל-PET CT מחר');
  });
});
