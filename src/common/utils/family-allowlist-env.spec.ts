import { parseFamilyAllowlistEnv } from './family-allowlist-env';

describe('parseFamilyAllowlistEnv', () => {
  it('parses phone:label:gender entries', () => {
    expect(
      parseFamilyAllowlistEnv('0521234567:דוגמה:female,972529876543::male'),
    ).toEqual([
      { phoneNumber: '972521234567', label: 'דוגמה', gender: 'female' },
      { phoneNumber: '972529876543', label: undefined, gender: 'male' },
    ]);
  });

  it('skips invalid segments', () => {
    expect(parseFamilyAllowlistEnv(',bad,:onlylabel,')).toEqual([]);
  });
});
