import { Gender } from '@prisma/client';
import { normalizeIsraeliPhone } from './phone';

export type FamilyRosterEntry = {
  phoneNumber: string;
  /** Name from env, or null when the env entry is a bare phone (access-only). */
  displayName: string | null;
  /** Gender from env, or null when not specified. */
  gender: Gender | null;
};

/**
 * Parse ALLOWED_PHONE_NUMBERS. The env is primarily an **access list**; name
 * and gender live in the `FamilyMember` table. When an entry only has a phone,
 * `displayName`/`gender` are `null` so callers never clobber table values.
 * - `972521234567:שם:female` — optional bootstrap name/gender
 * - `972521234567` — access only (no name/gender)
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
    const displayName = segments[1] || null;
    const genderRaw = segments[2]?.toLowerCase();
    const gender: Gender | null =
      genderRaw === 'female'
        ? Gender.female
        : genderRaw === 'male'
          ? Gender.male
          : null;
    entries.push({ phoneNumber, displayName, gender });
  }
  return entries;
}

export function phoneNumbersFromRoster(entries: FamilyRosterEntry[]): string[] {
  return [...new Set(entries.map((e) => e.phoneNumber))];
}
