export type ReconcileUpdateResult = {
  title?: string;
  location?: string;
  mergeNotes: boolean;
};

export function parseReconcileUpdateResponse(raw: unknown): ReconcileUpdateResult {
  const base: ReconcileUpdateResult = { mergeNotes: false };
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return base;
  }
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === 'string' ? o.title.trim() : undefined;
  const location = typeof o.location === 'string' ? o.location.trim() : undefined;
  const mergeNotes = o.mergeNotes === true;
  return {
    title: title && title.length > 0 ? title : undefined,
    location: location && location.length > 0 ? location : undefined,
    mergeNotes,
  };
}
