import { Gender } from '@prisma/client';

export type FamilyPersona = {
  name: string;
  gender: Gender;
  userId?: string;
};

export type ResolvedTransport = {
  transportUserId: string | null;
  transportNotes: string;
  driverName: string | null;
  driverGender: Gender | null;
};

/** Build AI prompt block for Hebrew verb gender (יסיע/תסיע, etc.). */
export function formatFamilyPersonasForPrompt(
  personas: FamilyPersona[],
): string {
  if (personas.length === 0) {
    return '';
  }
  const lines = personas.map((p) => {
    const verbs =
      p.gender === 'female'
        ? 'תסיע, תיקח, תלווה, תחזיר (לא יסיע/ייקח/ילווה)'
        : 'יסיע, ייקח, ילווה, יחזיר (לא תסיע/תיקח/תלווה)';
    return `- ${p.name} (${p.gender}): ${verbs}`;
  });
  return (
    'KNOWN_FAMILY — use correct Hebrew verb gender when this name appears in transport or replies:\n' +
    lines.join('\n')
  );
}

/** Fix common masculine/feminine mismatches for known family names in stored text. */
export function applyFamilyVerbGender(
  text: string,
  personas: FamilyPersona[],
): string {
  let out = text;
  for (const { name, gender } of personas) {
    if (!out.includes(name)) {
      continue;
    }
    const n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (gender === 'female') {
      out = out
        .replace(new RegExp(`(${n})\\s+יסיע`, 'gu'), '$1 תסיע')
        .replace(new RegExp(`(${n})\\s+ייקח`, 'gu'), '$1 תיקח')
        .replace(new RegExp(`(${n})\\s+ילווה`, 'gu'), '$1 תלווה')
        .replace(new RegExp(`(${n})\\s+יחזיר`, 'gu'), '$1 תחזיר');
    } else {
      out = out
        .replace(new RegExp(`(${n})\\s+תסיע`, 'gu'), '$1 יסיע')
        .replace(new RegExp(`(${n})\\s+תיקח`, 'gu'), '$1 ייקח')
        .replace(new RegExp(`(${n})\\s+תלווה`, 'gu'), '$1 ילווה')
        .replace(new RegExp(`(${n})\\s+תחזיר`, 'gu'), '$1 יחזיר');
    }
  }
  return out;
}

/** First token of allowlist label (e.g. "שגיא - טלפון עבודה" → "שגיא"). */
export function personaNameFromLabel(
  label: string | null | undefined,
): string | null {
  const trimmed = label?.trim();
  if (!trimmed) {
    return null;
  }
  const first = trimmed.split(/\s+/)[0];
  return first && first.length >= 2 ? first : null;
}

export function namesMatch(driverHint: string, candidate: string): boolean {
  const a = driverHint.trim();
  const b = candidate.trim();
  if (!a || !b) {
    return false;
  }
  return b === a || b.startsWith(a) || a.startsWith(b);
}
