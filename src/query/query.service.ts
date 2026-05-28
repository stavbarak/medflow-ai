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

  private isPastOrSoFarQuestion(question: string): boolean {
    return /(עד\s*היום|עד\s*כה|עד\s*עכשיו|עד\s*כאן|עד\s*עכשיו|היה|כבר|בעבר|פעם|מה\s+היה|כמה\s+היו|עד\s+עכשיו)/iu.test(
      question,
    );
  }

  private extractIvKeyword(question: string): string | null {
    // Examples: "עירוי קיטרודה", "עירויי קיטרודה", "עירוי קיטרודה כבר היו..."
    const m = /עירוי(?:י)?\s*([א-ת][א-ת"'\-]{2,})/iu.exec(question);
    if (!m?.[1]) {
      return null;
    }
    const word = m[1].trim();
    if (word.length < 3) {
      return null;
    }
    return word;
  }

  /** Expanded facts for Q&A: always upcoming; optionally past+stats for "so far" questions. */
  async buildQnAFactsPayload(question: string) {
    const now = new Date();
    const pastFrom = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const includePast = this.isPastOrSoFarQuestion(question);
    const ivKeyword = this.extractIvKeyword(question);
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
    const ivWhere = {
      OR: [{ title: { contains: 'עירוי' } }, { notes: { contains: 'עירוי' } }],
    };
    const ivTreatmentsPastCountPromise = includePast
      ? this.prisma.appointment.count({
          where: {
            AND: [ivWhere, { dateTime: { lt: now } }],
          },
        })
      : Promise.resolve(0);
    const ivTreatmentsUpcomingCountPromise = includePast
      ? this.prisma.appointment.count({
          where: {
            AND: [ivWhere, { dateTime: { gte: now } }],
          },
        })
      : Promise.resolve(0);

    const ivKeywordStatsPromise = includePast && ivKeyword
      ? Promise.all([
          this.prisma.appointment.count({
            where: {
              AND: [
                ivWhere,
                { dateTime: { lt: now } },
                {
                  OR: [
                    { title: { contains: ivKeyword } },
                    { notes: { contains: ivKeyword } },
                  ],
                },
              ],
            },
          }),
          this.prisma.appointment.count({
            where: {
              AND: [
                ivWhere,
                { dateTime: { gte: now } },
                {
                  OR: [
                    { title: { contains: ivKeyword } },
                    { notes: { contains: ivKeyword } },
                  ],
                },
              ],
            },
          }),
        ])
      : Promise.resolve(null);

    const [upcoming, recentPast, ivTreatmentsPastCount, ivTreatmentsUpcomingCount, ivKeywordStats] = await Promise.all([
      upcomingPromise,
      recentPastPromise,
      ivTreatmentsPastCountPromise,
      ivTreatmentsUpcomingCountPromise,
      ivKeywordStatsPromise,
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
      stats: includePast
        ? {
            ivTreatmentsPastCount,
            ivTreatmentsUpcomingCount,
            ivTreatmentsTotalCount: ivTreatmentsPastCount + ivTreatmentsUpcomingCount,
            ivTreatmentKeyword: ivKeyword,
            ivKeywordPastCount: ivKeywordStats ? ivKeywordStats[0] : undefined,
            ivKeywordUpcomingCount: ivKeywordStats ? ivKeywordStats[1] : undefined,
            ivKeywordTotalCount: ivKeywordStats
              ? ivKeywordStats[0] + ivKeywordStats[1]
              : undefined,
          }
        : undefined,
      upcomingAppointments: upcoming.map((a) => this.toFactRow(a)),
      recentPastAppointments: includePast
        ? recentPast.map((a) => this.toFactRow(a))
        : [],
    };
  }

  async answerQuestion(question: string) {
    const facts = await this.buildQnAFactsPayload(question);
    const factsJson = JSON.stringify(facts, null, 0);
    return this.ai.answerQuestionFromFacts(question, factsJson);
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
  ): Promise<string> {
    const question = stripWakeWord(userText);
    if (!question) {
      const facts = await this.buildUpcomingFactsPayload();
      return this.formatFactsDumpHebrew(facts, replyOptions);
    }
    const facts = await this.buildQnAFactsPayload(question);
    const factsJson = JSON.stringify(facts, null, 0);
    return this.ai.answerQuestionFromFacts(question, factsJson, replyOptions);
  }
}
