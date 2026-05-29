import { parseAllowedPhoneNumbersEnv } from './family-roster-env';

describe('parseAllowedPhoneNumbersEnv', () => {
  it('parses phone:displayName:gender entries', () => {
    expect(
      parseAllowedPhoneNumbersEnv('0521234567:דוגמה:female,972529876543::male'),
    ).toEqual([
      {
        phoneNumber: '972521234567',
        displayName: 'דוגמה',
        gender: 'female',
      },
      {
        phoneNumber: '972529876543',
        displayName: null,
        gender: 'male',
      },
    ]);
  });

  it('leaves name/gender null for phone-only entries (table owns them)', () => {
    expect(parseAllowedPhoneNumbersEnv('972521234567')).toEqual([
      {
        phoneNumber: '972521234567',
        displayName: null,
        gender: null,
      },
    ]);
  });
});
