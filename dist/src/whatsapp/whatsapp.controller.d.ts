import type { Request } from 'express';
import { WhatsappService } from './whatsapp.service';
type RequestWithRawBody = Request & {
    rawBody?: Buffer;
};
export declare class WhatsappController {
    private readonly whatsapp;
    constructor(whatsapp: WhatsappService);
    verify(mode: string, token: string, challenge: string): string;
    webhook(req: RequestWithRawBody, signature: string | undefined, body: unknown): Promise<{
        status: string;
    }>;
}
export {};
