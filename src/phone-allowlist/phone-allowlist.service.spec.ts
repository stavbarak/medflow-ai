import { PhoneAllowlistService } from './phone-allowlist.service';

describe('PhoneAllowlistService', () => {
  const prisma = {
    allowedPhone: {
      findUnique: jest.fn(),
    },
  };
  const config = {
    get: jest.fn(),
  };

  function svc() {
    return new PhoneAllowlistService(
      prisma as unknown as ConstructorParameters<typeof PhoneAllowlistService>[0],
      config as unknown as ConstructorParameters<typeof PhoneAllowlistService>[1],
    );
  }

  beforeEach(() => {
    jest.resetAllMocks();
    config.get.mockReturnValue(undefined);
  });

  it('allows numbers from env ALLOWED_PHONE_NUMBERS', async () => {
    config.get.mockReturnValue('972521234567, 052-123-4567');
    prisma.allowedPhone.findUnique.mockResolvedValue(null);
    await expect(svc().isAllowed('0521234567')).resolves.toBe(true);
    expect(prisma.allowedPhone.findUnique).not.toHaveBeenCalled();
  });

  it('allows numbers from database', async () => {
    prisma.allowedPhone.findUnique.mockResolvedValue({ phoneNumber: '972521234567' });
    await expect(svc().isAllowed('972521234567')).resolves.toBe(true);
  });

  it('rejects unknown numbers', async () => {
    prisma.allowedPhone.findUnique.mockResolvedValue(null);
    await expect(svc().isAllowed('972500000000')).resolves.toBe(false);
  });
});
