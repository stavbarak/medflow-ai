/** Normalize WhatsApp / Israeli numbers to digits with country code 972 when applicable. */
export function normalizeIsraeliPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('972')) {
    return digits;
  }
  if (digits.startsWith('0')) {
    return `972${digits.slice(1)}`;
  }
  if (digits.length === 9) {
    return `972${digits}`;
  }
  return digits;
}
