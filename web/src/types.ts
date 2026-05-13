export type User = {
  id: string;
  name: string;
  phoneNumber: string;
  role: string | null;
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
  requirements?: Requirement[];
};

export type AuthResponse = {
  access_token: string;
  user: User;
};
