/**
 * Defense-in-depth guard against the model leaking non-Hebrew words (e.g. "puedo").
 * A small allowlist keeps established medical/proper-noun abbreviations that have no
 * Hebrew form.
 */
const ALLOWED_LATIN = new Set([
  'PET',
  'CT',
  'PETCT',
  'MRI',
  'IV',
  'FDG',
  'PSA',
  'CRP',
  'EKG',
  'ECG',
  'PCR',
]);

const LATIN_WORD_RE = /[A-Za-z][A-Za-z-]*/g;

function isAllowed(word: string): boolean {
  return ALLOWED_LATIN.has(word.toUpperCase().replace(/-/g, ''));
}

/** True if the text contains a Latin-script word that is not on the allowlist. */
export function hasDisallowedLatin(text: string): boolean {
  const matches = text.match(LATIN_WORD_RE);
  if (!matches) {
    return false;
  }
  return matches.some((w) => !isAllowed(w));
}

/** Remove disallowed Latin words and tidy the resulting whitespace/punctuation. */
export function stripDisallowedLatin(text: string): string {
  return text
    .replace(LATIN_WORD_RE, (w) => (isAllowed(w) ? w : ''))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([.,!?:;])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/ +\n/g, '\n')
    .trim();
}
