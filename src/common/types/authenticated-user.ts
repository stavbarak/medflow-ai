/** JWT-loaded user (no password hash). */
export type AuthenticatedUser = {
  id: string;
  name: string;
  phoneNumber: string;
  role: string | null;
};
