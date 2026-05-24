import { normalizeIsraeliPhone } from './phone';

/** Default: אבא's mobile from family allowlist (0528777939). */
export const DEFAULT_PATIENT_PHONE = '972528777939';

export type PatientReplyOptions = {
  /** When true, bot replies use אתה/לך/אותך (the sender is the patient). */
  addressSecondPerson: boolean;
};

export function resolvePatientPhone(configValue?: string | null): string {
  const raw = configValue?.trim();
  return raw ? normalizeIsraeliPhone(raw) : DEFAULT_PATIENT_PHONE;
}

export function isPatientPhone(
  phoneInput: string,
  patientPhone = DEFAULT_PATIENT_PHONE,
): boolean {
  return normalizeIsraeliPhone(phoneInput.trim()) === patientPhone;
}

export function replyOptionsForSender(
  senderWaId: string,
  patientPhone = DEFAULT_PATIENT_PHONE,
): PatientReplyOptions {
  return {
    addressSecondPerson: isPatientPhone(senderWaId, patientPhone),
  };
}

/** Light post-processing for stored third-person phrases shown to the patient. */
export function adaptHebrewForPatientSecondPerson(text: string): string {
  return text
    .replace(/אותו/gu, 'אותך')
    .replace(/איתו/gu, 'איתך')
    .replace(/אליו/gu, 'אליך')
    .replace(/שלו/gu, 'שלך')
    .replace(/(?<![א-ת])לו(?![א-ת])/gu, 'לך')
    .replace(/אבא/gu, 'אתה')
    .replace(/\s+/g, ' ')
    .trim();
}

export function patientLabelForPrompt(
  defaultLabel: string,
  options?: PatientReplyOptions,
): string {
  if (options?.addressSecondPerson) {
    return 'the patient (the person messaging — use second person Hebrew: אתה/לך/אותך/יש לך when generating text for them)';
  }
  return defaultLabel;
}

export function patientAnswerInstruction(options?: PatientReplyOptions): string {
  if (!options?.addressSecondPerson) {
    return '';
  }
  return (
    'The reader IS the patient. Reply in second person (אתה/לך/אותך): e.g. "יש לך תור", "עדי יסיע אותך". ' +
    'Never say אבא when addressing them. Adapt transport/notes from facts to second person when needed.'
  );
}
