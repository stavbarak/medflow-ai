import { Gender, Prisma } from '@prisma/client';

export const familyMemberPublicSelect = {
  displayName: true,
  phoneNumber: true,
  gender: true,
} satisfies Prisma.FamilyMemberSelect;

export const userWithMemberSelect = {
  id: true,
  role: true,
  familyMember: { select: familyMemberPublicSelect },
} satisfies Prisma.UserSelect;

export type UserWithMember = Prisma.UserGetPayload<{
  select: typeof userWithMemberSelect;
}>;

export type PublicUser = {
  id: string;
  name: string;
  phoneNumber: string;
  role: string | null;
  gender: Gender;
};

export function toPublicUser(user: UserWithMember): PublicUser {
  return {
    id: user.id,
    name: user.familyMember.displayName,
    phoneNumber: user.familyMember.phoneNumber,
    role: user.role,
    gender: user.familyMember.gender,
  };
}

export const transportUserSelect = {
  id: true,
  familyMember: { select: familyMemberPublicSelect },
} satisfies Prisma.UserSelect;

export type TransportUserRow = Prisma.UserGetPayload<{
  select: typeof transportUserSelect;
}>;

export function transportUserDisplay(row: TransportUserRow | null | undefined) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.familyMember.displayName,
    gender: row.familyMember.gender,
    phoneNumber: row.familyMember.phoneNumber,
  };
}
