import { Gender } from '@prisma/client';
import { normalizeIsraeliPhone } from './phone';

export type FamilyRosterEntry = {
  phoneNumber: string;
  displayName: string;
  gender: Gender;
};

/**
 * Parse ALLOWED_PHONE_NUMBERS:
 * - `972521234567:שם:female` (recommended)
 * - `972521234567` (phone only → displayName = phone, gender = male)
 */
export function parseAllowedPhoneNumbersEnv(raw: string): FamilyRosterEntry[] {
  const entries: FamilyRosterEntry[] = [];
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const segments = trimmed.split(':').map((s) => s.trim());
    const phoneNumber = normalizeIsraeliPhone(segments[0] ?? '');
    if (!phoneNumber) {
      continue;
    }
    const displayName = segments[1] || phoneNumber;
    const genderRaw = (segments[2] ?? 'male').toLowerCase();
    const gender: Gender =
      genderRaw === 'female' ? Gender.female : Gender.male;
    entries.push({ phoneNumber, displayName, gender });
  }
  return entries;
}

export function phoneNumbersFromRoster(entries: FamilyRosterEntry[]): string[] {
  return [...new Set(entries.map((e) => e.phoneNumber))];
}
