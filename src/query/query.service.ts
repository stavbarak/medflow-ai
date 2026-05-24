import { Injectable } from '@nestjs/common';
import { formatAppointmentWhenHebrew } from '../common/utils/appointment-datetime';
import { formatAppointmentTransportHebrew } from '../common/utils/appointment-transport';
import { type PatientReplyOptions } from '../common/utils/patient-address';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { FamilyPersonaService } from '../phone-allowlist/family-persona.service';
import { stripWakeWord } from '../common/utils/wake-word';

@Injectable()
export class QueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly familyPersonas: FamilyPersonaService,
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
        transportUser: {
          select: { name: true, gender: true },
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
        transportUser: a.transportUser,
        transportNotes: a.transportNotes,
        transportDisplay: formatAppointmentTransportHebrew(a),
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
  async formatFactsDumpHebrew(
    facts: Awaited<ReturnType<QueryService['buildFactsPayload']>>,
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

  async answerWakeWord(
    userText: string,
    replyOptions?: PatientReplyOptions,
  ): Promise<string> {
    const question = stripWakeWord(userText);
    const facts = await this.buildFactsPayload();
    if (!question) {
      return this.formatFactsDumpHebrew(facts, replyOptions);
    }
    const factsJson = JSON.stringify(facts, null, 0);
    return this.ai.answerQuestionFromFacts(question, factsJson, replyOptions);
  }
}
