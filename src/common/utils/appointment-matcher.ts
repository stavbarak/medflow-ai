import { formatAppointmentWhenHebrew } from './appointment-datetime';
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
export function pickAppointmentForUpdate(
  payload: string,
  appointments: AppointmentMatchRow[],
): AppointmentMatchRow | null {
  const result = resolveUpdateTarget(payload, appointments);
  return result.status === 'resolved' ? result.appointment : null;
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

export function formatAmbiguousUpdatePromptHebrew(
  appointments: AppointmentMatchRow[],
): string {
  const lines = appointments.map((a, i) => {
    const when = formatAppointmentWhenHebrew(a.dateTime, true);
    return `${i + 1}. ${a.title} — ${when}, ${a.location}`;
  });
  return (
    `יש כמה תורים באותו יום:\n${lines.join('\n')}\n` +
    'נסו לציין שם המרפאה, המיקום, או פרטים נוספים כדי שאדע למי התכוונתם.'
  );
}
