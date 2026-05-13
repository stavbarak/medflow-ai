import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';

type FindMany = PrismaService['appointment']['findMany'];
type FindManyArgs = Parameters<FindMany>[0];
type FindManyResult = Awaited<ReturnType<FindMany>>;

describe('AppointmentsService (Stage 2)', () => {
  let service: AppointmentsService;

  const findMany = jest.fn<FindManyResult, [FindManyArgs?]>();
  const prismaMock = {
    appointment: {
      findMany,
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(AppointmentsService);
    jest.clearAllMocks();
  });

  describe('next', () => {
    it('returns earliest appointment with dateTime >= now (UTC)', async () => {
      prismaMock.appointment.findMany.mockResolvedValue([
        { id: 'a1', dateTime: new Date('2026-06-01T10:00:00.000Z') },
      ]);

      const row: Awaited<ReturnType<AppointmentsService['next']>> =
        await service.next();

      const callArg = findMany.mock.calls[0]?.[0];
      const gteDate = (callArg?.where as { dateTime?: { gte?: Date } })
        ?.dateTime?.gte;
      expect(gteDate).toBeInstanceOf(Date);
      expect(callArg?.orderBy).toEqual({ dateTime: 'asc' });
      expect(callArg?.take).toBe(1);
      expect(row?.id).toBe('a1');
    });

    it('returns null when no future appointments', async () => {
      prismaMock.appointment.findMany.mockResolvedValue([]);
      await expect(service.next()).resolves.toBeNull();
    });
  });

  describe('upcoming', () => {
    it('uses optional from ISO as lower bound and caps limit', async () => {
      prismaMock.appointment.findMany.mockResolvedValue([]);
      const fromIso = '2026-03-01T08:00:00.000Z';

      await service.upcoming(fromIso, 5);

      const args = findMany.mock.calls[0]?.[0];
      expect(args?.where).toEqual({
        dateTime: { gte: new Date(fromIso) },
      });
      expect(args?.orderBy).toEqual({ dateTime: 'asc' });
      expect(args?.take).toBe(5);
    });

    it('defaults from to now when omitted', async () => {
      prismaMock.appointment.findMany.mockResolvedValue([]);
      const before = Date.now();

      await service.upcoming(undefined, 20);

      const arg = findMany.mock.calls[0]?.[0];
      const where = arg?.where;
      const gte = where?.dateTime;
      expect(
        gte &&
          typeof gte === 'object' &&
          'gte' in gte &&
          gte.gte instanceof Date,
      ).toBe(true);
      if (
        gte &&
        typeof gte === 'object' &&
        'gte' in gte &&
        gte.gte instanceof Date
      ) {
        expect(gte.gte.getTime()).toBeGreaterThanOrEqual(before - 1000);
      }
      expect(arg?.take).toBe(20);
    });
  });
});
