import { Gender } from '@prisma/client';
import { formatTransportHebrew } from './transport-display';

describe('formatTransportHebrew', () => {
  it('uses feminine verb for female driver', () => {
    expect(
      formatTransportHebrew({
        driver: { name: 'שירי', gender: Gender.female },
      }),
    ).toBe('שירי תסיע אותו');
  });

  it('uses second person for patient', () => {
    expect(
      formatTransportHebrew({
        driver: { name: 'עדי', gender: Gender.male },
        addressSecondPerson: true,
      }),
    ).toBe('עדי יסיע אותך');
  });

  it('appends transport notes', () => {
    expect(
      formatTransportHebrew({
        driver: { name: 'שירי', gender: Gender.female },
        transportNotes: 'תחזיר אחרי התור',
        addressSecondPerson: true,
      }),
    ).toContain('שירי תסיע אותך');
    expect(formatTransportHebrew({
      driver: { name: 'שירי', gender: Gender.female },
      transportNotes: 'תחזיר אחרי התור',
      addressSecondPerson: true,
    })).toContain('תחזיר');
  });
});
