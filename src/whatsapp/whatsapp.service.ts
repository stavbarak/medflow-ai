import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { RequirementsService } from '../requirements/requirements.service';
import { QueryService } from '../query/query.service';
import { normalizeIsraeliPhone } from '../common/utils/phone';
import { looksLikeQuestion } from '../common/utils/question-heuristic';

interface MetaTextMessage {
  from?: string;
  type?: string;
  text?: { body?: string };
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly appointments: AppointmentsService,
    private readonly requirements: RequirementsService,
    private readonly query: QueryService,
  ) {}

  verifyWebhook(
    mode: string | undefined,
    token: string | undefined,
    challenge: string | undefined,
  ): string {
    const verifyToken = this.config.get<string>('WHATSAPP_VERIFY_TOKEN');
    if (mode === 'subscribe' && token && verifyToken && token === verifyToken) {
      return challenge ?? '';
    }
    throw new UnauthorizedException('אימות וובהוק נכשל');
  }

  verifySignature(rawBody: Buffer | undefined, signature: string | undefined) {
    const secret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (!secret) {
      this.logger.warn('WHATSAPP_APP_SECRET לא מוגדר — דילוג על אימות חתימה');
      return;
    }
    if (!rawBody || !signature?.startsWith('sha256=')) {
      throw new UnauthorizedException('חתימה חסרה');
    }
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    const received = signature.slice(7);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(received, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new UnauthorizedException('חתימה לא תקינה');
    }
  }

  async handleWebhookPayload(
    rawBody: Buffer | undefined,
    signature: string | undefined,
    body: unknown,
  ): Promise<{ status: string }> {
    this.verifySignature(rawBody, signature);
    const messages = this.extractInboundMessages(body);
    for (const m of messages) {
      await this.dispatchMessage(m).catch((err) => {
        this.logger.error(err instanceof Error ? err.message : err);
      });
    }
    return { status: 'ok' };
  }

  private extractInboundMessages(body: unknown): Array<{
    from: string;
    text: string;
  }> {
    const out: Array<{ from: string; text: string }> = [];
    const root = body as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            messages?: MetaTextMessage[];
          };
        }>;
      }>;
    };
    const entries = root.entry ?? [];
    for (const e of entries) {
      for (const c of e.changes ?? []) {
        for (const msg of c.value?.messages ?? []) {
          if (msg.type === 'text' && msg.from && msg.text?.body) {
            out.push({ from: msg.from, text: msg.text.body });
          }
        }
      }
    }
    return out;
  }

  private async dispatchMessage(message: { from: string; text: string }) {
    const normalized = normalizeIsraeliPhone(message.from);
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ phoneNumber: normalized }, { phoneNumber: message.from }],
      },
    });
    if (!user) {
      await this.sendWhatsAppReply(
        message.from,
        'מספר זה לא רשום במערכת. יש להירשם דרך האפליקציה.',
      );
      return;
    }

    const text = message.text.trim();
    if (!text) {
      return;
    }

    if (looksLikeQuestion(text)) {
      try {
        const answer = await this.query.answerQuestion(text);
        await this.sendWhatsAppReply(message.from, answer);
      } catch {
        await this.sendWhatsAppReply(
          message.from,
          'לא הצלחתי לענות כרגע. נסו שוב מאוחר יותר.',
        );
      }
      return;
    }

    try {
      const extracted = await this.ai.extractAppointmentFromText(text);
      if (!extracted.dateTime || !extracted.location) {
        await this.sendWhatsAppReply(
          message.from,
          'לא הצלחתי לזהות תאריך או מיקום. נסו לנסח שוב.',
        );
        return;
      }

      const title = extracted.title?.trim() || 'תור';
      const created = await this.appointments.create({
        title,
        dateTime: extracted.dateTime,
        location: extracted.location,
        notes: extracted.notes ?? '',
        responsibleUserId: user.id,
      });

      if (extracted.requirements?.length) {
        for (const r of extracted.requirements) {
          await this.requirements.create(created.id, {
            description: r.description,
          });
        }
      }

      const when = new Date(created.dateTime).toLocaleString('he-IL', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
      await this.sendWhatsAppReply(
        message.from,
        `הוספתי תור ל-${when} ב${created.location}.`,
      );
    } catch {
      await this.sendWhatsAppReply(
        message.from,
        'לא הצלחתי לעבד את ההודעה. נסו שוב או פתחו תור דרך האפליקציה.',
      );
    }
  }

  private async sendWhatsAppReply(toRaw: string, body: string) {
    const token = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    if (!token || !phoneNumberId) {
      this.logger.log(`[WhatsApp לא מוגדר] ל-${toRaw}: ${body}`);
      return;
    }
    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toRaw.replace(/\D/g, ''),
        type: 'text',
        text: { preview_url: false, body },
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(`WhatsApp send failed: ${res.status} ${errText}`);
      throw new BadRequestException('שליחת הודעת וואטסאפ נכשלה');
    }
  }
}
