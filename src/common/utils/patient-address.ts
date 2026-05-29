import { Gender } from '@prisma/client';
import { normalizeIsraeliPhone } from './phone';

export type PatientReplyOptions = {
  /** When true, bot replies use אתה/לך/אותך (the sender is the patient). */
  addressSecondPerson: boolean;
  /** First name of the person we are replying to (for natural, personal replies). */
  senderName?: string | null;
  /** Gender of the person we are replying to (for correct gendered Hebrew). */
  senderGender?: Gender | null;
};

export function resolvePatientPhone(configValue?: string | null): string {
  const raw = configValue?.trim();
  return raw ? normalizeIsraeliPhone(raw) : '';
}

export function isPatientPhone(phoneInput: string, patientPhone: string): boolean {
  if (!patientPhone) {
    return false;
  }
  return normalizeIsraeliPhone(phoneInput.trim()) === patientPhone;
}

export function replyOptionsForSender(
  senderWaId: string,
  patientPhone: string,
  sender?: { name?: string | null; gender?: Gender | null },
): PatientReplyOptions {
  return {
    addressSecondPerson: isPatientPhone(senderWaId, patientPhone),
    senderName: sender?.name ?? null,
    senderGender: sender?.gender ?? null,
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

/**
 * Instruction telling the model who it is addressing (name + gender) so replies are
 * personal and use correct gendered Hebrew. The person addressed is always the sender.
 */
export function senderPersonaInstruction(options?: PatientReplyOptions): string {
  if (!options) {
    return '';
  }
  const parts: string[] = [];
  const name = options.senderName?.trim();
  if (name) {
    parts.push(
      `You are speaking with ${name}. Address them by name naturally (e.g. open with their name) when it fits.`,
    );
  }
  if (options.senderGender) {
    parts.push(
      options.senderGender === 'female'
        ? 'The person you address is female — use feminine second-person Hebrew (את, and feminine verb forms such as שמת/ביקשת/רוצה).'
        : 'The person you address is male — use masculine second-person Hebrew (אתה, and masculine verb forms such as שמת/ביקשת/רוצה).',
    );
  }
  return parts.length ? ` ${parts.join(' ')}` : '';
}
