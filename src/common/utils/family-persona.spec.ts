import { Gender } from '@prisma/client';
import { applyFamilyVerbGender } from './family-persona';

describe('applyFamilyVerbGender', () => {
  const personas = [
    { name: 'שירי', gender: Gender.female },
    { name: 'עדי', gender: Gender.male },
  ];

  it('fixes feminine driver verbs for Shiri', () => {
    expect(
      applyFamilyVerbGender('שירי יסיע אותך', personas),
    ).toBe('שירי תסיע אותך');
  });

  it('fixes masculine driver verbs for Adi', () => {
    expect(applyFamilyVerbGender('עדי תסיע', personas)).toBe('עדי יסיע');
  });
});
