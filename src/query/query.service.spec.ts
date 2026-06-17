import { Test, TestingModule } from '@nestjs/testing';
import { QueryService } from './query.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { FamilyPersonaService } from '../phone-allowlist/family-persona.service';

type FindMany = PrismaService['appointment']['findMany'];
type FindManyArgs = Parameters<FindMany>[0];
type FindManyResult = Awaited<ReturnType<FindMany>>;

describe('QueryService (Stage 3)', () => {
  let service: QueryService;

  const findMany = jest.fn<FindManyResult, [FindManyArgs?]>();
  const count = jest.fn<number, any[]>();
  const answerQuestionFromFacts = jest.fn();

  const prismaMock = {
    appointment: {
      findMany,
      count,
    },
    usefulContact: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const aiMock = {
    answerQuestionFromFacts,
  };

  const familyPersonasMock = {
    getPersonas: jest.fn().mockResolvedValue([]),
    getPromptBlock: jest.fn().mockResolvedValue(''),
    findGenderForPhone: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AiService, useValue: aiMock },
        { provide: FamilyPersonaService, useValue: familyPersonasMock },
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
        responsibleUser: {
          id: 'u1',
          familyMember: {
            displayName: 'יעל',
            phoneNumber: '972501234567',
            gender: 'female',
          },
        },
        transportUser: null,
        transportNotes: '',
        requirements: [
          { description: 'טופס 17', isDone: false },
          { description: 'בדיקת דם', isDone: true },
        ],
      },
    ]);
    answerQuestionFromFacts.mockResolvedValue('התור הבא ב-15.7 ב-09:30.');

    count.mockResolvedValue(0);
    const answer = await service.answerQuestion('מתי התור הבא?');

    // Q&A facts payload now includes a broader window (upcoming + recent past + stats),
    // so findMany may be called more than once.
    expect(findMany).toHaveBeenCalled();

    expect(answerQuestionFromFacts).toHaveBeenCalledTimes(1);
    const [q, factsJson] = answerQuestionFromFacts.mock.calls[0] as [
      string,
      string,
    ];
    expect(q).toBe('מתי התור הבא?');
    const facts = JSON.parse(factsJson) as any;
    expect(Array.isArray(facts.upcomingAppointments)).toBe(true);
    expect(facts.scope?.kind).toBe('qna');
    // stats is only included for explicit past/"so far" questions
    expect(answer).toBe('התור הבא ב-15.7 ב-09:30.');
  });

  it('still calls AI with empty facts when no upcoming appointments', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    answerQuestionFromFacts.mockResolvedValue(
      'אין תורים עתידיים שמורים במערכת.',
    );

    await service.answerQuestion('מה צריך להביא?');

    expect(answerQuestionFromFacts).toHaveBeenCalledWith(
      'מה צריך להביא?',
      expect.stringContaining('"upcomingAppointments":[]'),
      undefined,
      undefined,
    );
  });

  it('always answers from DB facts (no free-mode routing)', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    answerQuestionFromFacts.mockResolvedValue('42.');

    const answer = await service.answerQuestion('מה משמעות החיים?');

    // Even an off-topic question loads facts and goes through the grounded path.
    expect(findMany).toHaveBeenCalled();
    expect(answerQuestionFromFacts).toHaveBeenCalledTimes(1);
    expect(answer).toBe('42.');
  });

  it('includes keyword stats + matching rows for count questions', async () => {
    const dt1 = new Date('2026-06-01T08:00:00.000Z');
    const dt2 = new Date('2026-06-15T08:00:00.000Z');
    findMany.mockImplementation((args) => {
      const where = JSON.stringify(args?.where ?? '');
      if (where.includes('פט סיטי')) {
        return Promise.resolve([
          { id: '1', title: 'פט סיטי', dateTime: dt1, timeKnown: true, location: 'x', notes: '', transportNotes: '', requirements: [], responsibleUser: null, transportUser: null },
          { id: '2', title: 'פט סיטי', dateTime: dt2, timeKnown: true, location: 'x', notes: '', transportNotes: '', requirements: [], responsibleUser: null, transportUser: null },
        ]);
      }
      return Promise.resolve([]);
    });
    answerQuestionFromFacts.mockResolvedValue('יש שני פט סיטי.');

    await service.answerQuestion('כמה פט סיטי יש?');

    const [, factsJson] = answerQuestionFromFacts.mock.calls[0] as [
      string,
      string,
    ];
    const facts = JSON.parse(factsJson) as any;
    expect(facts.stats?.keyword).toBe('פט סיטי');
    expect(facts.stats?.count).toBe(2);
    expect(facts.stats?.appointments).toHaveLength(2);
  });

  it('retries once then strips stray non-Hebrew words (Hebrew-only guard)', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    answerQuestionFromFacts.mockResolvedValue('כן, אני puedo לעזור לך.');

    const answer = await service.answerQuestion('מה שלומך?');

    // First answer leaked Latin → one retry; still leaked → stripped.
    expect(answerQuestionFromFacts).toHaveBeenCalledTimes(2);
    expect(answer).not.toMatch(/puedo/);
    expect(answer).toBe('כן, אני לעזור לך.');
  });
});
