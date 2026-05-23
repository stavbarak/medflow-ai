/** Parse model output for smart notes merge. */
export function parseNotesMergeResponse(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const notes = (raw as { notes?: unknown }).notes;
  if (typeof notes !== 'string') {
    return null;
  }
  const trimmed = notes.trim();
  return trimmed.length > 0 ? trimmed : null;
}
