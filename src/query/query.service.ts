import { Injectable } from '@nestjs/common';
import { formatAppointmentWhenHebrew } from '../common/utils/appointment-datetime';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class QueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  /** Builds JSON facts from DB for grounded answers (UTC stored times). */
  async buildFactsPayload() {
    const now = new Date();
    const upcoming = await this.prisma.appointment.findMany({
      where: { dateTime: { gte: now } },
      orderBy: { dateTime: 'asc' },
      take: 15,
      include: {
        requirements: true,
        responsibleUser: {
          select: { name: true, phoneNumber: true },
        },
      },
    });
    return {
      generatedAt: now.toISOString(),
      upcomingAppointments: upcoming.map((a) => ({
        id: a.id,
        title: a.title,
        dateTime: a.dateTime.toISOString(),
        location: a.location,
        notes: a.notes,
        responsible: a.responsibleUser,
        requirements: a.requirements.map((r) => ({
          description: r.description,
          isDone: r.isDone,
        })),
      })),
    };
  }

  async answerQuestion(question: string) {
    const facts = await this.buildFactsPayload();
    const factsJson = JSON.stringify(facts, null, 0);
    return this.ai.answerQuestionFromFacts(question, factsJson);
  }

  /** Hebrew summary of upcoming appointments + requirements (no LLM). */
  formatFactsDumpHebrew(
    facts: Awaited<ReturnType<QueryService['buildFactsPayload']>>,
  ): string {
    const { upcomingAppointments } = facts;
    if (upcomingAppointments.length === 0) {
      return 'אין תורים קרובים במערכת כרגע.';
    }
    const lines = ['📋 תורים ומשימות קרובים:', ''];
    for (const a of upcomingAppointments) {
      const when = formatAppointmentWhenHebrew(a.dateTime, true);
      lines.push(`• ${a.title} — ${when}`);
      lines.push(`  📍 ${a.location}`);
      if (a.notes) {
        lines.push(`  📝 ${a.notes}`);
      }
      if (a.responsible?.name) {
        lines.push(`  👤 אחראי: ${a.responsible.name}`);
      }
      const openReqs = a.requirements.filter((r) => !r.isDone);
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

  /**
   * Wake word (חנטריש): full DB dump when called alone; grounded Q&A when a question follows.
   */
  async answerWakeWord(userText: string): Promise<string> {
    const question = userText
      .replace(new RegExp('חנטריש', 'g'), '')
      .trim();
    const facts = await this.buildFactsPayload();
    if (!question) {
      return this.formatFactsDumpHebrew(facts);
    }
    const factsJson = JSON.stringify(facts, null, 0);
    return this.ai.answerQuestionFromFacts(question, factsJson);
  }
}
