import {
  adaptHebrewForPatientSecondPerson,
  isPatientPhone,
  replyOptionsForSender,
} from './patient-address';

const PATIENT = '972521111111';

describe('patient-address', () => {
  it('recognizes patient phone in 05 and 972 formats', () => {
    expect(isPatientPhone('0521111111', PATIENT)).toBe(true);
    expect(isPatientPhone('972521111111', PATIENT)).toBe(true);
    expect(isPatientPhone('972521234567', PATIENT)).toBe(false);
  });

  it('sets second person for patient sender', () => {
    expect(replyOptionsForSender('0521111111', PATIENT).addressSecondPerson).toBe(
      true,
    );
    expect(replyOptionsForSender('0521234567', PATIENT).addressSecondPerson).toBe(
      false,
    );
  });

  it('never treats sender as patient when PATIENT_PHONE unset', () => {
    expect(replyOptionsForSender('0521111111', '').addressSecondPerson).toBe(false);
  });

  it('adapts third-person transport phrasing', () => {
    expect(adaptHebrewForPatientSecondPerson('שירי תיקח ותחזיר אותו')).toBe(
      'שירי תיקח ותחזיר אותך',
    );
  });
});
