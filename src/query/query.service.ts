import { Injectable } from '@nestjs/common';
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
}
