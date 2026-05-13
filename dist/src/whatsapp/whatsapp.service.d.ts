import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { RequirementsService } from '../requirements/requirements.service';
import { QueryService } from '../query/query.service';
export declare class WhatsappService {
    private readonly config;
    private readonly prisma;
    private readonly ai;
    private readonly appointments;
    private readonly requirements;
    private readonly query;
    private readonly logger;
    constructor(config: ConfigService, prisma: PrismaService, ai: AiService, appointments: AppointmentsService, requirements: RequirementsService, query: QueryService);
    verifyWebhook(mode: string | undefined, token: string | undefined, challenge: string | undefined): string;
    verifySignature(rawBody: Buffer | undefined, signature: string | undefined): void;
    handleWebhookPayload(rawBody: Buffer | undefined, signature: string | undefined, body: unknown): Promise<{
        status: string;
    }>;
    private extractInboundMessages;
    private dispatchMessage;
    private sendWhatsAppReply;
}
