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
  const classifyQuestionMode = jest.fn();
  const answerFreeQuestion = jest.fn();

  const prismaMock = {
    appointment: {
      findMany,
      count,
    },
  };

  const aiMock = {
    answerQuestionFromFacts,
    classifyQuestionMode,
    answerFreeQuestion,
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
    classifyQuestionMode.mockResolvedValue({ mode: 'grounded' });

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
    classifyQuestionMode.mockResolvedValue({ mode: 'grounded' });

    await service.answerQuestion('מה צריך להביא?');

    expect(answerQuestionFromFacts).toHaveBeenCalledWith(
      'מה צריך להביא?',
      expect.stringContaining('"upcomingAppointments":[]'),
    );
  });

  it('routes non-DB questions to free mode without touching Prisma', async () => {
    classifyQuestionMode.mockResolvedValue({ mode: 'free' });
    answerFreeQuestion.mockResolvedValue('42.');

    const answer = await service.answerQuestion('מה משמעות החיים?');

    expect(findMany).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
    expect(answerQuestionFromFacts).not.toHaveBeenCalled();
    expect(answerFreeQuestion).toHaveBeenCalledWith('מה משמעות החיים?');
    expect(answer).toBe('42.');
  });
});
