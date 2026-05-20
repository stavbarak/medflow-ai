import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { QueryService } from '../query/query.service';
import { BOT_WAKE_WORD } from '../common/utils/question-heuristic';

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
    throw new UnauthorizedException('Webhook verification failed');
  }

  verifySignature(rawBody: Buffer | undefined, signature: string | undefined) {
    const secret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (!secret) {
      this.logger.warn(
        'WHATSAPP_APP_SECRET not set — skipping signature verification',
      );
      return;
    }
    if (!rawBody || !signature?.startsWith('sha256=')) {
      throw new UnauthorizedException('Missing X-Hub-Signature-256 header');
    }
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    const received = signature.slice(7);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(received, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  async handleWebhookPayload(
    rawBody: Buffer | undefined,
    signature: string | undefined,
    body: unknown,
  ): Promise<{ status: string }> {
    this.verifySignature(rawBody, signature);
    const messages = this.extractInboundMessages(body);
    if (messages.length === 0) {
      this.logger.debug('WhatsApp webhook: no text messages in payload');
    }
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
          value?: { messages?: MetaTextMessage[] };
        }>;
      }>;
    };
    for (const e of root.entry ?? []) {
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
    const text = message.text.trim();
    if (!text) {
      return;
    }

    // Group-safe: reply only when explicitly called by name.
    if (!text.includes(BOT_WAKE_WORD)) {
      return;
    }

    await this.replyWakeWord(message.from, text);
  }

  private async replyWakeWord(from: string, text: string) {
    try {
      const reply = await this.query.answerWakeWord(text);
      await this.safeSend(from, reply);
    } catch (err) {
      this.logger.error(err instanceof Error ? err.message : err);
      try {
        const facts = await this.query.buildFactsPayload();
        await this.safeSend(from, this.query.formatFactsDumpHebrew(facts));
      } catch (fallbackErr) {
        this.logger.error(
          fallbackErr instanceof Error ? fallbackErr.message : fallbackErr,
        );
        await this.safeSend(from, 'לא הצלחתי לענות כרגע. נסו שוב מאוחר יותר.');
      }
    }
  }

  private async safeSend(to: string, message: string) {
    try {
      await this.sendWhatsappMessage(to, message);
    } catch (err) {
      this.logger.error(
        `Failed to send WhatsApp message to ${to}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async sendWhatsappMessage(to: string, message: string): Promise<void> {
    const token = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    if (!token || !phoneNumberId) {
      this.logger.warn(
        `WhatsApp not configured: message not sent to ${to} (missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID)`,
      );
      return;
    }

    try {
      await axios.post(
        `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: to.replace(/\D/g, ''),
          type: 'text',
          text: { body: message },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (err) {
      if (axios.isAxiosError(err)) {
        this.logger.error(
          `WhatsApp send failed: ${err.response?.status} ${JSON.stringify(err.response?.data)}`,
        );
      }
      throw new BadRequestException('Failed to send WhatsApp message');
    }
  }
}
