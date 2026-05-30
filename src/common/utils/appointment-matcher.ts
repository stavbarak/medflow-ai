import {
  extractTimeFromText,
  formatAppointmentWhenHebrew,
  getJerusalemParts,
} from './appointment-datetime';
import {
  extractSubjectHintsForMatch,
  isPlaceholderTitle,
} from './wake-appointment-fields';

export type AppointmentMatchRow = {
  id: string;
  title: string;
  location: string;
  notes: string;
  transport?: string;
  transportNotes: string;
  createdAt: Date;
  dateTime: Date;
  timeKnown: boolean;
};

export type ResolveUpdateTargetResult =
  | { status: 'resolved'; appointment: AppointmentMatchRow }
  | { status: 'ambiguous'; appointments: AppointmentMatchRow[] }
  | { status: 'unresolved' };

function meaningfulPhrases(...parts: string[]): string[] {
  const out = new Set<string>();
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length >= 3) {
      out.add(trimmed);
    }
    for (const word of trimmed.split(/\s+/)) {
      if (word.length >= 3) {
        out.add(word);
      }
    }
  }
  return [...out];
}

function scoreAppointmentMatch(
  payload: string,
  appointment: AppointmentMatchRow,
): number {
  let score = 0;
  const haystacks = [
    appointment.title,
    appointment.location,
    appointment.notes,
    appointment.transportNotes,
  ];
  const phrases = meaningfulPhrases(...haystacks);

  for (const phrase of phrases) {
    if (phrase.length >= 4 && payload.includes(phrase)) {
      score += phrase.length * 2;
    } else if (phrase.length >= 3 && payload.includes(phrase)) {
      score += phrase.length;
    }
  }

  for (const h of haystacks) {
    if (h.length >= 5 && payload.includes(h)) {
      score += h.length * 3;
    }
  }

  if (isPlaceholderTitle(appointment.title)) {
    for (const hint of extractSubjectHintsForMatch(payload)) {
      if (hint.length >= 4 && payload.includes(hint)) {
        score += hint.length * 2;
      }
    }
  } else {
    for (const hint of extractSubjectHintsForMatch(payload)) {
      if (appointment.title.includes(hint) || appointment.notes.includes(hint)) {
        score += hint.length * 2;
      }
    }
  }

  return score;
}

/** Pick one appointment from candidates using title/location/notes overlap. */
function jerusalemTimeMatches(
  dateTime: Date,
  time: { hour: number; minute: number },
): boolean {
  const parts = getJerusalemParts(dateTime);
  return parts.hour === time.hour && parts.minute === time.minute;
}

/** Narrow same-day candidates when the message includes an explicit time. */
export function narrowCandidatesByExplicitTime(
  payload: string,
  candidates: AppointmentMatchRow[],
): AppointmentMatchRow[] {
  const time = extractTimeFromText(payload);
  if (!time) {
    return candidates;
  }
  return candidates.filter((a) =>
    jerusalemTimeMatches(new Date(a.dateTime), time),
  );
}

export function pickAppointmentForUpdate(
  payload: string,
  appointments: AppointmentMatchRow[],
): AppointmentMatchRow | null {
  const result = resolveUpdateTarget(payload, appointments);
  return result.status === 'resolved' ? result.appointment : null;
}

/**
 * Resolve one appointment from a candidate list (same day or global).
 * When a time is mentioned but no row matches it, returns unresolved instead of guessing.
 */
export function resolveAppointmentCandidates(
  payload: string,
  candidates: AppointmentMatchRow[],
): ResolveUpdateTargetResult {
  if (candidates.length === 0) {
    return { status: 'unresolved' };
  }

  const time = extractTimeFromText(payload);
  if (time) {
    const atTime = narrowCandidatesByExplicitTime(payload, candidates);
    if (atTime.length > 0) {
      const result = resolveUpdateTarget(payload, atTime);
      if (
        result.status === 'resolved' &&
        extractSubjectHintsForMatch(payload).length > 0 &&
        scoreAppointmentMatch(payload, result.appointment) === 0
      ) {
        return { status: 'unresolved' };
      }
      return result;
    }
    if (candidates.length >= 1) {
      return { status: 'unresolved' };
    }
  }

  return resolveUpdateTarget(payload, candidates);
}

/**
 * Resolve which appointment to update. When several share the same day and text
 * does not distinguish them, returns ambiguous so the caller can ask the user.
 */
export function resolveUpdateTarget(
  payload: string,
  candidates: AppointmentMatchRow[],
): ResolveUpdateTargetResult {
  if (candidates.length === 0) {
    return { status: 'unresolved' };
  }
  if (candidates.length === 1) {
    return { status: 'resolved', appointment: candidates[0] };
  }

  const ranked = candidates
    .map((a) => ({ a, score: scoreAppointmentMatch(payload, a) }))
    .sort((x, y) => {
      if (y.score !== x.score) {
        return y.score - x.score;
      }
      return (
        new Date(y.a.createdAt).getTime() - new Date(x.a.createdAt).getTime()
      );
    });

  const top = ranked[0];
  const second = ranked[1];

  if (top.score === 0) {
    return { status: 'ambiguous', appointments: candidates };
  }

  if (top.score > second.score) {
    return { status: 'resolved', appointment: top.a };
  }

  const tied = ranked.filter((r) => r.score === top.score).map((r) => r.a);
  return { status: 'ambiguous', appointments: tied };
}

function formatAmbiguousAppointmentListHebrew(
  appointments: AppointmentMatchRow[],
): string {
  return appointments
    .map((a, i) => {
      const when = formatAppointmentWhenHebrew(a.dateTime, a.timeKnown);
      return `${i + 1}. ${a.title} — ${when}, ${a.location}`;
    })
    .join('\n');
}

export function formatAmbiguousUpdatePromptHebrew(
  appointments: AppointmentMatchRow[],
): string {
  return (
    `יש כמה תורים באותו יום:\n${formatAmbiguousAppointmentListHebrew(appointments)}\n` +
    'נסו לציין שם המרפאה, המיקום, או פרטים נוספים כדי שאדע למי התכוונתם.'
  );
}

export function formatAmbiguousCancelPromptHebrew(
  appointments: AppointmentMatchRow[],
): string {
  return (
    `יש כמה תורים באותו יום:\n${formatAmbiguousAppointmentListHebrew(appointments)}\n` +
    'נסו לציין שעה, סוג ביקור (למשל אונקולוג), או מרפאה כדי שאדע איזה תור לבטל.'
  );
}

export function formatNoTimeMatchOnDayHebrew(
  requestedTime: { hour: number; minute: number },
  appointments: AppointmentMatchRow[],
): string {
  const hh = String(requestedTime.hour).padStart(2, '0');
  const mm = String(requestedTime.minute).padStart(2, '0');
  const lines = appointments.map((a) => {
    const when = formatAppointmentWhenHebrew(a.dateTime, a.timeKnown);
    return `• ${a.title} (${when})`;
  });
  return (
    `לא מצאתי תור בשעה ${hh}:${mm} באותו יום. התורים שיש:\n${lines.join('\n')}`
  );
}
