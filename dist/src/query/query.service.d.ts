import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
export declare class QueryService {
    private readonly prisma;
    private readonly ai;
    constructor(prisma: PrismaService, ai: AiService);
    buildFactsPayload(): Promise<{
        generatedAt: string;
        upcomingAppointments: {
            id: string;
            title: string;
            dateTime: string;
            location: string;
            notes: string;
            responsible: {
                phoneNumber: string;
                name: string;
            } | null;
            requirements: {
                description: string;
                isDone: boolean;
            }[];
        }[];
    }>;
    answerQuestion(question: string): Promise<string>;
}
