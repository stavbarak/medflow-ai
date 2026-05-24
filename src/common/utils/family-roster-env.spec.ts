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
        displayName: '972529876543',
        gender: 'male',
      },
    ]);
  });

  it('defaults gender for phone-only entries', () => {
    expect(parseAllowedPhoneNumbersEnv('972521234567')).toEqual([
      {
        phoneNumber: '972521234567',
        displayName: '972521234567',
        gender: 'male',
      },
    ]);
  });
});
