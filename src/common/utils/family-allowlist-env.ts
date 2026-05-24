import { normalizeIsraeliPhone } from './phone';

export type FamilyAllowlistEntry = {
  phoneNumber: string;
  label?: string;
  gender?: 'male' | 'female';
};

/**
 * Parse FAMILY_ALLOWLIST env: comma-separated `phone:label:gender` (label/gender optional).
 * Example: 972521234567:דוגמה:female,972529876543:אחר:male
 */
export function parseFamilyAllowlistEnv(raw: string): FamilyAllowlistEntry[] {
  const entries: FamilyAllowlistEntry[] = [];
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
    const label = segments[1] || undefined;
    const genderRaw = segments[2]?.toLowerCase();
    const gender =
      genderRaw === 'male' || genderRaw === 'female' ? genderRaw : undefined;
    entries.push({ phoneNumber, label, gender });
  }
  return entries;
}
