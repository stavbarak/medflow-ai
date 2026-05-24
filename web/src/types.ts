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

export type AuthResponse = {
  access_token: string;
  user: User;
};
