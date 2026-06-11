export type User = {
  id: string;
  name: string;
  phoneNumber: string;
  role: string | null;
  gender: 'male' | 'female' | null;
};

export type Requirement = {
  id: string;
  description: string;
  isDone: boolean;
};

export type Appointment = {
  id: string;
  title: string;
  dateTime: string;
  location: string;
  notes: string;
  transportNotes: string;
  transportUser?: { id: string; name: string; gender: 'male' | 'female' | null } | null;
  requirements?: Requirement[];
};

export function formatTransportCell(a: Appointment): string {
  if (a.transportUser?.name) {
    const extra = a.transportNotes?.trim();
    return extra
      ? `${a.transportUser.name} — ${extra}`
      : a.transportUser.name;
  }
  return a.transportNotes?.trim() || '—';
}

export type UsefulContact = {
  id: string;
  name: string;
  value: string;
  notes: string;
};

/** True when a saved value looks like a dialable Israeli/intl phone (not a ת"ז etc.). */
export function isPhoneLike(value: string): boolean {
  const v = value.trim();
  if (v.startsWith('+') || v.startsWith('*')) {
    return true;
  }
  const digits = v.replace(/\D/g, '');
  // Israeli numbers start 0 + area/mobile prefix (02-09); IDs like 012345678 don't.
  return /^0[2-9]/.test(digits) && digits.length >= 8 && digits.length <= 11;
}

export type AuthResponse = {
  access_token: string;
  user: User;
};
