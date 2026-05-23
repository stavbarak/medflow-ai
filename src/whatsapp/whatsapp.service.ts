import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { AiService } from '../ai/ai.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { RequirementsService } from '../requirements/requirements.service';
import { QueryService } from '../query/query.service';
import {
  formatAmbiguousUpdatePromptHebrew,
  pickAppointmentForUpdate,
  resolveUpdateTarget,
} from '../common/utils/appointment-matcher';
import {
  formatAppointmentWhenHebrew,
  listDateMatchesInText,
  parseAppointmentWhenFromMatch,
  parseAppointmentWhenFromText,
  textHasExplicitTime,
} from '../common/utils/appointment-datetime';
import { buildSchedulePatch } from '../common/utils/appointment-update-patch';
import {
  inferWakeAppointmentFields,
  isLikelyDateOnlyTime,
  isPlaceholderLocation,
  isPlaceholderTitle,
} from '../common/utils/wake-appointment-fields';
import {
  looksLikeAddingToExisting,
  looksLikeNewAppointment,
} from './whatsapp-wake-intent';
import { BOT_WAKE_WORD } from '../common/utils/question-heuristic';
import {
  classifyWakePayload,
  stripWakeWord,
} from './whatsapp-wake-intent';

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

    // Group-safe: only respond when the bot is called by name.
    if (!text.includes(BOT_WAKE_WORD)) {
      return;
    }

    await this.replyWakeWord(message.from, text);
  }

  private async replyWakeWord(from: string, text: string) {
    const payload = stripWakeWord(text);
    const intent = classifyWakePayload(payload);

    try {
      switch (intent) {
        case 'list':
          await this.safeSend(
            from,
            this.query.formatFactsDumpHebrew(
              await this.query.buildFactsPayload(),
            ),
          );
          return;
        case 'question':
          await this.safeSend(from, await this.query.answerWakeWord(text));
          return;
        case 'cancel':
          await this.safeSend(from, await this.handleWakeCancel(payload));
          return;
        case 'create':
          await this.safeSend(from, await this.handleWakeCreate(payload));
          return;
        case 'update':
          await this.safeSend(from, await this.handleWakeUpdate(payload));
          return;
      }
    } catch (err) {
      this.logger.error(err instanceof Error ? err.message : err);
      await this.safeSend(from, 'לא הצלחתי לעבד את ההודעה. נסו לנסח שוב.');
    }
  }

  private async handleWakeCreate(payload: string): Promise<string> {
    const extracted = await this.ai.extractAppointmentFromText(payload);
    if (!extracted.dateTime) {
      return 'לא הצלחתי לזהות תאריך. נסו: חנטריש, לאבא יש תור ב-27.5 בבית חולים X';
    }

    const inferred = inferWakeAppointmentFields(payload);
    const title =
      extracted.title?.trim() ||
      inferred.title ||
      'תור';
    const location =
      extracted.location?.trim() ||
      inferred.location ||
      'ייקבע';
    const created = await this.appointments.create({
      title,
      dateTime: extracted.dateTime,
      location,
      notes: extracted.notes?.trim() ?? '',
    });

    if (extracted.requirements?.length) {
      for (const r of extracted.requirements) {
        await this.requirements.create(created.id, {
          description: r.description,
        });
      }
    }

    const when = formatAppointmentWhenHebrew(
      created.dateTime,
      extracted.hasTime,
    );
    const timeNote = extracted.hasTime ? '' : ' (שעה לא צוינה)';
    return `הוספתי תור: ${created.title} — ${when}${timeNote}, ${created.location}.`;
  }

  private async handleWakeUpdate(payload: string): Promise<string> {
    if (looksLikeNewAppointment(payload)) {
      return this.handleWakeCreate(payload);
    }

    const extracted = await this.ai.extractAppointmentUpdateDelta(payload);
    const lookup = await this.resolveAppointmentForUpdate(payload);
    if (lookup.status === 'ambiguous') {
      return formatAmbiguousUpdatePromptHebrew(lookup.appointments);
    }
    if (lookup.status === 'unresolved') {
      if (looksLikeNewAppointment(payload) || parseAppointmentWhenFromText(payload)) {
        return this.handleWakeCreate(payload);
      }
      return 'לא מצאתי תור לעדכון. נסו לציין תאריך (למשל 25.5) או שם מרפאה.';
    }
    const target = lookup.appointment;

    const reconciled = await this.ai.reconcileAppointmentUpdate(
      {
        title: target.title,
        location: target.location,
        notes: target.notes ?? '',
        dateTimeIso: new Date(target.dateTime).toISOString(),
      },
      payload,
    );

    const inferred = inferWakeAppointmentFields(payload);
    const patch: {
      title?: string;
      dateTime?: string;
      location?: string;
      notes?: string;
    } = {};

    const { patch: schedulePatch, timeMentionedInMessage } =
      buildSchedulePatch(payload, target);
    Object.assign(patch, schedulePatch);

    const titleCandidate =
      reconciled.title || inferred.title || extracted.title?.trim();
    if (titleCandidate && !isPlaceholderTitle(titleCandidate)) {
      if (
        isPlaceholderTitle(target.title) ||
        (reconciled.title && reconciled.title !== target.title)
      ) {
        patch.title = titleCandidate;
      }
    }

    const locationCandidate =
      reconciled.location ||
      inferred.location ||
      extracted.location?.trim();
    if (locationCandidate && !isPlaceholderLocation(locationCandidate)) {
      if (
        isPlaceholderLocation(target.location) ||
        (reconciled.location && reconciled.location !== target.location)
      ) {
        patch.location = locationCandidate;
      }
    }

    const shouldMergeNotes =
      reconciled.mergeNotes || looksLikeAddingToExisting(payload);
    if (shouldMergeNotes) {
      const merged = await this.ai.mergeAppointmentNotes(
        target.notes ?? '',
        payload,
      );
      if (merged && merged !== (target.notes ?? '').trim()) {
        patch.notes = merged;
      }
    }

    if (
      !patch.dateTime &&
      !patch.notes &&
      !patch.title &&
      !patch.location
    ) {
      return 'לא זיהיתי מה להוסיף. נסו: חנטריש תעדכן שהתור ב-30.7 הוא בשעה 9:30, או תוסיף ש…';
    }

    const updated = await this.appointments.update(target.id, patch);

    if (extracted.requirements?.length) {
      for (const r of extracted.requirements) {
        await this.requirements.create(updated.id, {
          description: r.description,
        });
      }
    }

    const showTime =
      timeMentionedInMessage || !isLikelyDateOnlyTime(updated.dateTime);
    const when = formatAppointmentWhenHebrew(updated.dateTime, showTime);
    const timeNote = showTime ? '' : ' (שעה לא צוינה)';
    const addedNotes = patch.notes && patch.notes !== target.notes;
    const suffix = addedNotes ? ' (הערות עודכנו)' : '';
    return `עדכנתי תור: ${updated.title} — ${when}${timeNote}, ${updated.location}.${suffix}`;
  }

  private async resolveAppointmentForUpdate(payload: string) {
    const dates = listDateMatchesInText(payload);

    if (dates.length >= 1) {
      const ref = dates.length >= 2 ? dates[0] : dates[dates.length - 1];
      const when = parseAppointmentWhenFromMatch(
        ref.day,
        ref.month,
        ref.yearRaw,
        payload,
      );
      const onDay = await this.appointments.findOnCalendarDay(
        new Date(when.dateTime),
      );
      if (onDay.length > 0) {
        return resolveUpdateTarget(payload, onDay);
      }
      return { status: 'unresolved' as const };
    }

    const all = await this.appointments.findAll();
    const matched = pickAppointmentForUpdate(payload, all);
    if (matched) {
      return { status: 'resolved' as const, appointment: matched };
    }

    const recent = await this.appointments.findMostRecentlyCreated();
    if (recent) {
      return { status: 'resolved' as const, appointment: recent };
    }
    return { status: 'unresolved' as const };
  }

  private async handleWakeCancel(payload: string): Promise<string> {
    const extracted = await this.ai.extractAppointmentFromText(payload);
    if (!extracted.dateTime) {
      return 'לא הצלחתי לזהות איזה תאריך לבטל. נסו: חנטריש תבטל את התור ב-27.5';
    }

    const day = new Date(extracted.dateTime);
    const rows = await this.appointments.findOnCalendarDay(day);
    if (rows.length === 0) {
      const when = formatAppointmentWhenHebrew(day, false);
      return `לא מצאתי תור בתאריך ${when}.`;
    }

    for (const row of rows) {
      await this.appointments.remove(row.id);
    }

    const lines = rows.map((r) => {
      const when = formatAppointmentWhenHebrew(r.dateTime, true);
      return `• ${r.title} (${when})`;
    });

    return `ביטלתי ${rows.length} תור/ים:\n${lines.join('\n')}`;
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

  /**
   * Password-reset OTP. Uses an approved template when configured (works outside the 24h window).
   * Otherwise sends plain text (only works if the user messaged your business number recently).
   */
  async sendPasswordResetCode(to: string, code: string): Promise<void> {
    const templateName = this.config.get<string>('WHATSAPP_OTP_TEMPLATE_NAME');
    const templateLang =
      this.config.get<string>('WHATSAPP_OTP_TEMPLATE_LANG') ?? 'he';

    if (templateName) {
      await this.postWhatsAppMessage(to, {
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLang },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: code }],
            },
            {
              type: 'button',
              sub_type: 'url',
              index: '0',
              parameters: [{ type: 'text', text: code }],
            },
          ],
        },
      });
      return;
    }

    const text = `קוד איפוס MedFlow: ${code}\nבתוקף 15 דקות. אל תשתף את הקוד.`;
    try {
      await this.postWhatsAppMessage(to, {
        type: 'text',
        text: { body: text },
      });
    } catch (err) {
      if (this.isOutsideMessagingWindow(err)) {
        throw new BadRequestException(
          'לא ניתן לשלוח קוד ב-WhatsApp (חלון 24 שעות): שלח הודעה למספר העסקי +972-53-571-2070 (למשל "חנטריש") ונסה שוב, או הגדר תבנית OTP ב-Meta (WHATSAPP_OTP_TEMPLATE_NAME).',
        );
      }
      throw err;
    }
  }

  async sendWhatsappMessage(to: string, message: string): Promise<void> {
    try {
      await this.postWhatsAppMessage(to, {
        type: 'text',
        text: { body: message },
      });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        this.logger.error(
          `WhatsApp send failed: ${err.response?.status} ${JSON.stringify(err.response?.data)}`,
        );
      }
      throw new BadRequestException('שליחת הודעת וואטסאפ נכשלה');
    }
  }

  private async postWhatsAppMessage(
    to: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const token = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    if (!token || !phoneNumberId) {
      throw new ServiceUnavailableException(
        'WhatsApp is not configured on the server (missing access token or phone number id)',
      );
    }

    await axios.post(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to.replace(/\D/g, ''),
        ...payload,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );
  }

  private isOutsideMessagingWindow(err: unknown): boolean {
    if (!axios.isAxiosError(err)) {
      return false;
    }
    const body = err.response?.data as {
      error?: { code?: number; message?: string; error_subcode?: number };
    };
    const code = body?.error?.code;
    const msg = body?.error?.message ?? '';
    return (
      code === 131047 ||
      code === 131026 ||
      /24.?hour|re-engagement|message undeliverable/i.test(msg)
    );
  }
}
