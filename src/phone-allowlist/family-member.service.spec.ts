import { FamilyMemberService } from './family-member.service';

describe('FamilyMemberService', () => {
  const prisma = {
    familyMember: {
      findUnique: jest.fn(),
    },
  };
  const config = { get: jest.fn() };

  const svc = () =>
    new FamilyMemberService(
      prisma as unknown as ConstructorParameters<typeof FamilyMemberService>[0],
      config as unknown as ConstructorParameters<typeof FamilyMemberService>[1],
    );

  it('allows numbers from env ALLOWED_PHONE_NUMBERS', async () => {
    config.get.mockReturnValue('972521234567:דוגמה:female, 052-123-4567');
    prisma.familyMember.findUnique.mockResolvedValue(null);
    await expect(svc().isAllowed('0521234567')).resolves.toBe(true);
    expect(prisma.familyMember.findUnique).not.toHaveBeenCalled();
  });

  it('allows numbers from database', async () => {
    config.get.mockReturnValue('');
    prisma.familyMember.findUnique.mockResolvedValue({ phoneNumber: '972521234567' });
    await expect(svc().isAllowed('972521234567')).resolves.toBe(true);
  });

  it('rejects unknown numbers', async () => {
    config.get.mockReturnValue('');
    prisma.familyMember.findUnique.mockResolvedValue(null);
    await expect(svc().isAllowed('972509999999')).resolves.toBe(false);
  });
});
