import { classifyWakePayload } from './whatsapp-wake-intent';

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
});
