import { Test, TestingModule } from '@nestjs/testing';
import { QueryService } from './query.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

type FindMany = PrismaService['appointment']['findMany'];
type FindManyArgs = Parameters<FindMany>[0];
type FindManyResult = Awaited<ReturnType<FindMany>>;

describe('QueryService (Stage 3)', () => {
  let service: QueryService;

  const findMany = jest.fn<FindManyResult, [FindManyArgs?]>();
  const answerQuestionFromFacts = jest.fn();

  const prismaMock = {
    appointment: {
      findMany,
    },
  };

  const aiMock = {
    answerQuestionFromFacts,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AiService, useValue: aiMock },
      ],
    }).compile();

    service = module.get(QueryService);
    jest.clearAllMocks();
  });

  it('loads upcoming appointments as facts and delegates Hebrew answer to AI', async () => {
    const dt = new Date('2026-07-15T09:30:00.000Z');
    findMany.mockResolvedValue([
      {
        id: 'ap1',
        title: 'MRI',
        dateTime: dt,
        location: 'תל השומר',
        notes: 'צום',
        responsibleUser: { name: 'יעל', phoneNumber: '972501234567' },
        requirements: [
          { description: 'טופס 17', isDone: false },
          { description: 'בדיקת דם', isDone: true },
        ],
      },
    ]);
    answerQuestionFromFacts.mockResolvedValue('התור הבא ב-15.7 ב-09:30.');

    const answer = await service.answerQuestion('מתי התור הבא?');

    const callArg = findMany.mock.calls[0]?.[0];
    expect(callArg?.take).toBe(15);
    expect(callArg?.orderBy).toEqual({ dateTime: 'asc' });
    const where = callArg?.where;
    const dtFilter = where?.dateTime;
    expect(
      dtFilter &&
        typeof dtFilter === 'object' &&
        'gte' in dtFilter &&
        dtFilter.gte instanceof Date,
    ).toBe(true);
    expect(callArg?.include).toEqual({
      requirements: true,
      responsibleUser: {
        select: { name: true, phoneNumber: true },
      },
    });

    expect(answerQuestionFromFacts).toHaveBeenCalledTimes(1);
    const [q, factsJson] = answerQuestionFromFacts.mock.calls[0] as [
      string,
      string,
    ];
    expect(q).toBe('מתי התור הבא?');
    const facts = JSON.parse(factsJson) as {
      upcomingAppointments: Array<{ id: string; title: string }>;
    };
    expect(facts.upcomingAppointments).toHaveLength(1);
    expect(facts.upcomingAppointments[0]?.id).toBe('ap1');
    expect(answer).toBe('התור הבא ב-15.7 ב-09:30.');
  });

  it('still calls AI with empty facts when no upcoming appointments', async () => {
    findMany.mockResolvedValue([]);
    answerQuestionFromFacts.mockResolvedValue(
      'אין תורים עתידיים שמורים במערכת.',
    );

    await service.answerQuestion('מה צריך להביא?');

    expect(answerQuestionFromFacts).toHaveBeenCalledWith(
      'מה צריך להביא?',
      expect.stringContaining('"upcomingAppointments":[]'),
    );
  });
});
