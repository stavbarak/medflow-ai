import { parseContactSave } from './contact-save';

describe('parseContactSave', () => {
  it('parses "תשמור את המספר של X: phone"', () => {
    expect(
      parseContactSave('תשמור את המספר של ד"ר לוי: 03-1234567'),
    ).toEqual({ name: 'ד"ר לוי', value: '03-1234567' });
  });

  it('parses without a colon', () => {
    expect(
      parseContactSave('תוסיפי טלפון של המרפאה האונקולוגית 03-6974444'),
    ).toEqual({ name: 'המרפאה האונקולוגית', value: '03-6974444' });
  });

  it('parses "המספר של X הוא phone"', () => {
    expect(parseContactSave('המספר של המונית הוא 052-1234567')).toEqual({
      name: 'המונית',
      value: '052-1234567',
    });
  });

  it('parses an ID number and keeps the descriptor in the name', () => {
    expect(
      parseContactSave('תשמרי את תעודת הזהות של אבא: 012345678'),
    ).toEqual({ name: 'ת"ז של אבא', value: '012345678' });
    expect(parseContactSave('תשמור את הת"ז של אבא 012345678')).toEqual({
      name: 'ת"ז של אבא',
      value: '012345678',
    });
  });

  it('ignores questions about numbers', () => {
    expect(parseContactSave('מה המספר של המרפאה?')).toBeNull();
  });

  it('ignores appointment messages with dates/times', () => {
    expect(
      parseContactSave('תוסיף תור לאונקולוג ב-5.8 בשעה 12:00'),
    ).toBeNull();
    expect(parseContactSave('יש לאבא תור ב-27.5 באיכילוב')).toBeNull();
  });

  it('rejects save intent without a real phone', () => {
    expect(parseContactSave('תשמור את המספר של המרפאה')).toBeNull();
  });
});
