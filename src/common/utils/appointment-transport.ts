import { Gender } from '@prisma/client';
import { applyFamilyVerbGender, type FamilyPersona } from './family-persona';
import { adaptHebrewForPatientSecondPerson } from './patient-address';
import { formatTransportHebrew } from './transport-display';

type TransportUserRow = {
  name: string;
  gender: Gender | null;
} | null;

/** Display line for appointment transport (user link + notes, or notes-only fallback). */
export function formatAppointmentTransportHebrew(
  row: {
    transportUser?: TransportUserRow;
    transportNotes?: string | null;
  },
  opts?: {
    addressSecondPerson?: boolean;
    personas?: FamilyPersona[];
  },
): string {
  const notes = row.transportNotes?.trim() ?? '';

  if (row.transportUser?.name) {
    let line = formatTransportHebrew({
      driver: {
        name: row.transportUser.name,
        gender: row.transportUser.gender,
      },
      transportNotes: notes,
      addressSecondPerson: opts?.addressSecondPerson,
    });
    if (opts?.personas?.length && line) {
      line = applyFamilyVerbGender(line, opts.personas);
    }
    return line;
  }

  if (!notes) {
    return '';
  }

  let line = notes;
  if (opts?.personas?.length) {
    line = applyFamilyVerbGender(line, opts.personas);
  }
  if (opts?.addressSecondPerson) {
    line = adaptHebrewForPatientSecondPerson(line);
  }
  return line;
}
