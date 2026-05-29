import { Injectable } from '@nestjs/common';
import { formatAppointmentWhenHebrew } from '../common/utils/appointment-datetime';
import { formatAppointmentTransportHebrew } from '../common/utils/appointment-transport';
import { type PatientReplyOptions } from '../common/utils/patient-address';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { FamilyPersonaService } from '../phone-allowlist/family-persona.service';
import { stripWakeWord } from '../common/utils/wake-word';
import {
  transportUserDisplay,
  transportUserSelect,
} from '../common/utils/user-profile';
import {
  extractTreatmentKeyword,
  needsExpandedFacts,
} from '../common/utils/qna-facts-heuristic';
import {
  hasDisallowedLatin,
  stripDisallowedLatin,
} from '../common/utils/hebrew-only';
import type { ConversationTurnDto } from '../conversation/conversation.service';

@Injectable()
export class QueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly familyPersonas: FamilyPersonaService,
  ) {}

  private static readonly factsInclude = {
    requirements: true,
    responsibleUser: { select: transportUserSelect },
    transportUser: { select: transportUserSelect },
  } as const;

  private async loadAppointmentsForFacts(opts: {
    from: Date;
    to?: Date;
    order: 'asc' | 'desc';
    take: number;
  }): Promise<any[]> {
    return this.prisma.appointment.findMany({
      where: {
        dateTime: {
          gte: opts.from,
          ...(opts.to ? { lt: opts.to } : {}),
        },
      },
      orderBy: { dateTime: opts.order },
      take: opts.take,
      include: QueryService.factsInclude,
    });
  }

  private toFactRow(
    a: any,
  ) {
    return {
      id: a.id,
      title: a.title,
      dateTime: a.dateTime.toISOString(),
      whenHebrew: formatAppointmentWhenHebrew(a.dateTime, true),
      location: a.location,
      notes: a.notes,
      transportUser: transportUserDisplay(a.transportUser),
      transportNotes: a.transportNotes,
      transportDisplay: formatAppointmentTransportHebrew({
        transportUser: transportUserDisplay(a.transportUser),
        transportNotes: a.transportNotes,
      }),
      responsible: transportUserDisplay(a.responsibleUser),
      requirements: a.requirements.map((r: any) => ({
        description: r.description,
        isDone: r.isDone,
      })),
    };
  }

  /** Upcoming-only facts (used for wake-word list + lightweight Q&A). */
  async buildUpcomingFactsPayload() {
    const now = new Date();
    const upcoming = await this.loadAppointmentsForFacts({
      from: now,
      order: 'asc',
      take: 15,
    });
    return {
      generatedAt: now.toISOString(),
      scope: {
        kind: 'upcoming',
        limit: 15,
        count: upcoming.length,
      },
      upcomingAppointments: upcoming.map((a) => this.toFactRow(a)),
    };
  }

  private keywordWhere(keyword: string, dateTime: { lt?: Date; gte?: Date }) {
    return {
      AND: [
        {
          OR: [
            { title: { contains: keyword, mode: 'insensitive' as const } },
            { notes: { contains: keyword, mode: 'insensitive' as const } },
          ],
        },
        { dateTime },
      ],
    };
  }

  /**
   * Expanded facts for Q&A: always upcoming; past + focused keyword stats are added
   * when the question implies history, counting, prep, or a specific treatment/test.
   */
  async buildQnAFactsPayload(question: string) {
    const now = new Date();
    const pastFrom = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const includePast = needsExpandedFacts(question);
    const keyword = extractTreatmentKeyword(question);

    const upcomingPromise = this.loadAppointmentsForFacts({
      from: now,
      order: 'asc',
      take: 30,
    });
    const recentPastPromise = includePast
      ? this.loadAppointmentsForFacts({
          from: pastFrom,
          to: now,
          order: 'desc',
          take: 200,
        })
      : Promise.resolve([]);
    const keywordStatsPromise = keyword
      ? Promise.all([
          this.prisma.appointment.count({
            where: this.keywordWhere(keyword, { lt: now }),
          }),
          this.prisma.appointment.count({
            where: this.keywordWhere(keyword, { gte: now }),
          }),
        ])
      : Promise.resolve(null);

    const [upcoming, recentPast, keywordStats] = await Promise.all([
      upcomingPromise,
      recentPastPromise,
      keywordStatsPromise,
    ]);

    return {
      generatedAt: now.toISOString(),
      scope: {
        kind: 'qna',
        upcomingLimit: 30,
        recentPastDays: 365,
        recentPastLimit: 200,
        upcomingCount: upcoming.length,
        recentPastCount: recentPast.length,
        includePast,
      },
      stats: keywordStats
        ? {
            keyword,
            keywordPastCount: keywordStats[0],
            keywordUpcomingCount: keywordStats[1],
            keywordTotalCount: keywordStats[0] + keywordStats[1],
          }
        : undefined,
      upcomingAppointments: upcoming.map((a) => this.toFactRow(a)),
      recentPastAppointments: includePast
        ? recentPast.map((a) => this.toFactRow(a))
        : [],
    };
  }

  /**
   * Grounded answer with a Hebrew-only guard: if the model leaks a non-Hebrew word,
   * retry once, then strip any stray Latin as a last resort.
   */
  private async answerGroundedWithGuard(
    question: string,
    factsJson: string,
    replyOptions?: PatientReplyOptions,
    history?: ConversationTurnDto[],
  ): Promise<string> {
    let answer = await this.ai.answerQuestionFromFacts(
      question,
      factsJson,
      replyOptions,
      history,
    );
    if (hasDisallowedLatin(answer)) {
      answer = await this.ai.answerQuestionFromFacts(
        question,
        factsJson,
        replyOptions,
        history,
      );
      if (hasDisallowedLatin(answer)) {
        answer = stripDisallowedLatin(answer);
      }
    }
    return answer;
  }

  async answerQuestion(question: string) {
    const facts = await this.buildQnAFactsPayload(question);
    const factsJson = JSON.stringify(facts, null, 0);
    return this.answerGroundedWithGuard(question, factsJson);
  }

  /** Hebrew summary of upcoming appointments + requirements (no LLM). */
  async formatFactsDumpHebrew(
    facts: Awaited<ReturnType<QueryService['buildUpcomingFactsPayload']>>,
    replyOptions?: PatientReplyOptions,
  ): Promise<string> {
    const { upcomingAppointments } = facts;
    const second = replyOptions?.addressSecondPerson;
    const personas = await this.familyPersonas.getPersonas();
    if (upcomingAppointments.length === 0) {
      return second
        ? 'אין לך תורים קרובים במערכת כרגע.'
        : 'אין תורים קרובים במערכת כרגע.';
    }
    const lines = [
      second ? '📋 התורים והמשימות שלך:' : '📋 תורים ומשימות קרובים:',
      '',
    ];
    for (const a of upcomingAppointments) {
      const when = formatAppointmentWhenHebrew(a.dateTime, true);
      lines.push(`• ${a.title} — ${when}`);
      lines.push(`  📍 ${a.location}`);
      const transportLine = formatAppointmentTransportHebrew(
        {
          transportUser: a.transportUser,
          transportNotes: a.transportNotes,
        },
        { addressSecondPerson: second, personas },
      );
      if (transportLine) {
        lines.push(`  🚗 ${transportLine}`);
      }
      if (a.notes) {
        lines.push(`  📝 ${a.notes}`);
      }
      if (a.responsible?.name) {
        lines.push(`  👤 אחראי: ${a.responsible.name}`);
      }
      const openReqs = a.requirements.filter((r: { isDone: boolean }) => !r.isDone);
      if (openReqs.length) {
        lines.push('  משימות:');
        for (const r of openReqs) {
          lines.push(`    ○ ${r.description}`);
        }
      }
      lines.push('');
    }
    return lines.join('\n').trim();
  }

  async answerWakeWord(
    userText: string,
    replyOptions?: PatientReplyOptions,
    history?: ConversationTurnDto[],
  ): Promise<string> {
    const question = stripWakeWord(userText);
    if (!question) {
      const facts = await this.buildUpcomingFactsPayload();
      return this.formatFactsDumpHebrew(facts, replyOptions);
    }
    const facts = await this.buildQnAFactsPayload(question);
    const factsJson = JSON.stringify(facts, null, 0);
    return this.answerGroundedWithGuard(
      question,
      factsJson,
      replyOptions,
      history,
    );
  }
}
