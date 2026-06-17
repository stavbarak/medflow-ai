export type ParsedAppointmentUpdate = {
  title?: string;
  location?: string;
  notes?: string;
  /** Omit = unchanged; null = remove driver. */
  transportDriver?: string | null;
  /** Omit = unchanged; null = clear. */
  transportNotes?: string | null;
};

function optionalString(v: unknown): string | undefined {
  if (typeof v !== 'string') {
    return undefined;
  }
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function optionalStringOrNull(v: unknown): string | null | undefined {
  if (v === null) {
    return null;
  }
  return optionalString(v);
}

export function parseAppointmentUpdateResponse(
  raw: unknown,
): ParsedAppointmentUpdate {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {};
  }
  const o = raw as Record<string, unknown>;
  const out: ParsedAppointmentUpdate = {};
  const title = optionalString(o.title);
  const location = optionalString(o.location);
  const notes = typeof o.notes === 'string' ? o.notes.trim() : undefined;
  if (title) {
    out.title = title;
  }
  if (location) {
    out.location = location;
  }
  if (notes !== undefined) {
    out.notes = notes;
  }
  if ('transportDriver' in o) {
    out.transportDriver = optionalStringOrNull(o.transportDriver) ?? null;
  }
  if ('transportNotes' in o) {
    out.transportNotes = optionalStringOrNull(o.transportNotes) ?? null;
  }
  return out;
}
