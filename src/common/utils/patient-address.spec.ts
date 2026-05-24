import {
  adaptHebrewForPatientSecondPerson,
  DEFAULT_PATIENT_PHONE,
  isPatientPhone,
  replyOptionsForSender,
} from './patient-address';

describe('patient-address', () => {
  it('recognizes dad phone in 05 and 972 formats', () => {
    expect(isPatientPhone('0528777939', DEFAULT_PATIENT_PHONE)).toBe(true);
    expect(isPatientPhone('972528777939', DEFAULT_PATIENT_PHONE)).toBe(true);
    expect(isPatientPhone('972523211743', DEFAULT_PATIENT_PHONE)).toBe(false);
  });

  it('sets second person for patient sender', () => {
    expect(replyOptionsForSender('0528777939').addressSecondPerson).toBe(true);
    expect(replyOptionsForSender('0523211743').addressSecondPerson).toBe(false);
  });

  it('adapts third-person transport phrasing', () => {
    expect(adaptHebrewForPatientSecondPerson('שירי תיקח ותחזיר אותו')).toBe(
      'שירי תיקח ותחזיר אותך',
    );
  });
});
