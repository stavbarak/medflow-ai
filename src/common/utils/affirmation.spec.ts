import { isAffirmation } from './affirmation';

describe('isAffirmation', () => {
  it('recognizes short confirmations', () => {
    expect(isAffirmation('כן')).toBe(true);
    expect(isAffirmation('כן!')).toBe(true);
    expect(isAffirmation('אישור')).toBe(true);
    expect(isAffirmation('לבטל')).toBe(true);
    expect(isAffirmation('ok')).toBe(true);
  });

  it('rejects unrelated messages', () => {
    expect(isAffirmation('מתי התור הבא?')).toBe(false);
    expect(isAffirmation('לא, תשאיר אותו')).toBe(false);
    expect(isAffirmation('')).toBe(false);
  });
});
