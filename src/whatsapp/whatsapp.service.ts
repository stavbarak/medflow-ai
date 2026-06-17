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
  formatAmbiguousCancelPromptHebrew,
  formatAmbiguousUpdatePromptHebrew,
  formatNoTimeMatchOnDayHebrew,
  type AppointmentMatchRow,
  pickAppointmentForUpdate,
  resolveAppointmentCandidates,
  resolveUpdateTarget,
} from '../common/utils/appointment-matcher';
import {
  applyTimeToAppointmentDay,
  extractTimeFromText,
  formatAppointmentWhenHebrew,
  listDateMatchesInText,
  parseAppointmentWhenFromMatch,
  parseAppointmentWhenFromText,
  textHasExplicitTime,
} from '../common/utils/appointment-datetime';
import { buildSchedulePatch } from '../common/utils/appointment-update-patch';
import {
  inferWakeAppointmentFields,
  isPlaceholderLocation,
  isPlaceholderTitle,
} from '../common/utils/wake-appointment-fields';
import {
  classifyWakePayload,
  looksLikeNewAppointment,
  looksLikeNotesUpdate,
} from './whatsapp-wake-intent';
import { containsWakeWord, stripWakeWord } from '../common/utils/wake-word';

import {
  extractGroupWebhookEvents,
  formatGroupWebhookEvent,
} from './whatsapp-group-webhook';
import { extractInboundWhatsappMessages } from './whatsapp-inbound';
import type { WhatsappSendTarget } from './whatsapp-send-target';
import { individualTarget } from './whatsapp-send-target';
import { FamilyMemberService } from '../phone-allowlist/family-member.service';
import { PHONE_NOT_ON_ALLOWLIST_HE } from '../phone-allowlist/phone-allowlist.messages';
import { FamilyPersonaService } from '../phone-allowlist/family-persona.service';
import { formatAppointmentTransportHebrew } from '../common/utils/appointment-transport';
import { textMentionsTransport } from '../common/utils/transport-heuristic';
import { personaNameFromLabel } from '../common/utils/family-persona';
import { isAffirmation, isDecline } from '../common/utils/affirmation';
import { parseContactSave } from '../common/utils/contact-save';
import { ContactsService } from '../contacts/contacts.service';
import {
  ConversationService,
  type ConversationTurnDto,
  type PendingActionDto,
} from '../conversation/conversation.service';
import {
  type PatientReplyOptions,
  replyOptionsForSender,
  resolvePatientPhone,
} from '../common/utils/patient-address';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly ai: AiService,
    private readonly appointments: AppointmentsService,
    private readonly requirements: RequirementsService,
    private readonly query: QueryService,
    private readonly familyMembers: FamilyMemberService,
    private readonly familyPersonas: FamilyPersonaService,
    private readonly conversation: ConversationService,
    private readonly contacts: ContactsService,
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
    for (const event of extractGroupWebhookEvents(body)) {
      this.logger.log(formatGroupWebhookEvent(event));
    }
    const messages = extractInboundWhatsappMessages(body);
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

  private async dispatchMessage(message: {
    text: string;
    senderWaId: string;
    replyTo: WhatsappSendTarget;
  }) {
    const text = message.text.trim();
    if (!text) {
      return;
    }

    const hadWakeWord = containsWakeWord(text);
    // In group chats the bot must be called by name; in 1:1 DMs every message is for it.
    if (message.replyTo.type === 'group' && !hadWakeWord) {
      return;
    }

    if (!(await this.familyMembers.isAllowed(message.senderWaId))) {
      this.logger.debug(`Rejected unknown phone ${message.senderWaId}`);
      await this.safeSend(message.replyTo, PHONE_NOT_ON_ALLOWLIST_HE);
      return;
    }

    this.logger.debug(
      `Message from ${message.senderWaId} (${message.replyTo.type}, wakeWord=${hadWakeWord})`,
    );

    const replyOpts = await this.patientReplyOptions(message.senderWaId);

    // A pending action awaiting the user's reply (cancel confirmation, or a
    // follow-up time for an appointment created without one).
    const pending = await this.conversation.consumePendingAction(
      message.senderWaId,
    );
    if (pending) {
      const reply = await this.handlePendingAction(
        pending,
        text,
        replyOpts,
        message.senderWaId,
      );
      if (reply !== null) {
        await this.safeSend(message.replyTo, reply);
        await this.recordTurns(message.senderWaId, text, reply);
        return;
      }
    }

    const history = await this.conversation.getRecentTurns(
      message.senderWaId,
      { limit: 10 },
    );
    const reply = await this.composeReply(
      text,
      message.senderWaId,
      replyOpts,
      hadWakeWord,
      history,
    );
    const outbound =
      reply?.trim() ||
      'לא הצלחתי לעבד את ההודעה כרגע. נסו שוב בעוד רגע.';
    if (!reply?.trim()) {
      this.logger.warn(
        `composeReply returned empty for ${message.senderWaId}; sending fallback`,
      );
    }
    await this.safeSend(message.replyTo, outbound);
    await this.recordTurns(message.senderWaId, text, outbound);
  }

  private async patientReplyOptions(
    senderWaId: string,
  ): Promise<PatientReplyOptions> {
    const member = await this.familyMembers
      .findByPhone(senderWaId)
      .catch(() => null);
    const name =
      personaNameFromLabel(member?.displayName) ?? member?.displayName ?? null;
    return replyOptionsForSender(
      senderWaId,
      resolvePatientPhone(this.config.get<string>('PATIENT_PHONE')),
      { name, gender: member?.gender ?? null },
    );
  }

  /** Short greeting prefix using the sender's name (gender-neutral). */
  private greeting(replyOpts: PatientReplyOptions): string {
    const name = replyOpts.senderName?.trim();
    return name ? `${name}, ` : '';
  }

  private async recordTurns(
    senderWaId: string,
    userText: string,
    reply: string,
  ): Promise<void> {
    await this.conversation.appendTurn(senderWaId, 'user', userText);
    await this.conversation.appendTurn(senderWaId, 'assistant', reply);
  }

  /**
   * Act on a pending action given the user's next message.
   * Returns the reply to send, or null to fall through to normal processing
   * (e.g. the user ignored the prompt and asked something else).
   */
  private async handlePendingAction(
    pending: PendingActionDto,
    text: string,
    replyOpts: PatientReplyOptions,
    senderWaId: string,
  ): Promise<string | null> {
    if (pending.kind === 'cancel') {
      return isAffirmation(text)
        ? this.confirmPendingAction(pending, replyOpts)
        : null;
    }
    if (pending.kind === 'awaitTime') {
      return this.handleAwaitTimeReply(pending, text, replyOpts, senderWaId);
    }
    return null;
  }

  /** Fill in the hour for an appointment we saved without a time. */
  private async handleAwaitTimeReply(
    pending: PendingActionDto,
    text: string,
    replyOpts: PatientReplyOptions,
    senderWaId: string,
  ): Promise<string | null> {
    const greeting = this.greeting(replyOpts);

    if (textHasExplicitTime(text)) {
      let appt: { id: string; title: string; dateTime: Date | string };
      try {
        appt = await this.appointments.findOne(pending.appointmentId);
      } catch {
        return null; // appointment is gone — let the message be handled normally
      }
      const when = applyTimeToAppointmentDay(new Date(appt.dateTime), text);
      if (!when) {
        return null;
      }
      const updated = await this.appointments.update(pending.appointmentId, {
        dateTime: when.dateTime,
        timeKnown: true,
      });
      const formatted = formatAppointmentWhenHebrew(updated.dateTime, true);
      return `${greeting}עדכנתי — ${updated.title} ב-${formatted}.`;
    }

    if (isAffirmation(text)) {
      // "כן" without an actual time — keep waiting and ask again.
      await this.conversation.setPendingAction(senderWaId, pending);
      return `${greeting}באיזו שעה?`;
    }

    if (isDecline(text)) {
      return `${greeting}סבבה, השארתי בלי שעה. אפשר לעדכן מתי שתרצה.`;
    }

    return null; // unrelated message — process it normally
  }

  private async confirmPendingAction(
    pending: PendingActionDto,
    replyOpts: PatientReplyOptions,
  ): Promise<string> {
    const greeting = this.greeting(replyOpts);
    try {
      const removed = await this.appointments.remove(pending.appointmentId);
      const when = formatAppointmentWhenHebrew(
        removed.dateTime,
        removed.timeKnown,
      );
      return `${greeting}ביטלתי תור: ${removed.title} (${when}).`;
    } catch {
      return `${greeting}לא מצאתי את התור לביטול (ייתכן שכבר בוטל).`;
    }
  }

  private async composeReply(
    text: string,
    senderWaId: string,
    replyOpts: PatientReplyOptions,
    hadWakeWord: boolean,
    history: ConversationTurnDto[],
  ): Promise<string | null> {
    const payload = stripWakeWord(text);

    // "Save this number" is deterministic (regex) — handle before intent classification.
    const contactSave = parseContactSave(payload);
    if (contactSave) {
      try {
        return await this.handleContactSave(contactSave, replyOpts);
      } catch (err) {
        this.logger.error(
          `contact save failed: ${err instanceof Error ? err.message : err}`,
        );
        return 'לא הצלחתי לשמור את המספר. אפשר לנסות שוב?';
      }
    }

    const intent = classifyWakePayload(payload);

    try {
      // NOTE: every branch must `return await` — otherwise a rejected promise
      // escapes this try/catch and is silently dropped by the webhook handler.
      switch (intent) {
        case 'list':
          return await this.query.formatFactsDumpHebrew(
            await this.query.buildUpcomingFactsPayload(),
            replyOpts,
          );
        case 'question':
          return await this.query.answerWakeWord(text, replyOpts, history);
        case 'cancel':
          return await this.handleWakeCancel(
            payload,
            replyOpts,
            hadWakeWord,
            senderWaId,
          );
        case 'create':
          return await this.handleWakeCreate(payload, replyOpts, senderWaId);
        case 'update':
          return await this.handleWakeUpdate(payload, replyOpts, senderWaId);
      }
    } catch (err) {
      this.logger.error(
        `composeReply failed (intent=${intent}): ${err instanceof Error ? err.stack ?? err.message : err}`,
      );
      return 'לא הצלחתי לעבד את ההודעה כרגע. נסו שוב בעוד רגע.';
    }
    return null;
  }

  /** Save or update a useful number (phone, ת"ז, member number...). */
  private async handleContactSave(
    save: { name: string; value: string },
    replyOpts: PatientReplyOptions,
  ): Promise<string> {
    const greeting = this.greeting(replyOpts);
    const existing = await this.contacts.findByName(save.name);
    if (existing) {
      await this.contacts.update(existing.id, { value: save.value });
      return `${greeting}עדכנתי את המספר של ${existing.name}: ${save.value}.`;
    }
    await this.contacts.create({ name: save.name, value: save.value });
    return `${greeting}שמרתי את המספר של ${save.name}: ${save.value}. אפשר לשאול אותי עליו מתי שצריך.`;
  }

  private async handleWakeCreate(
    payload: string,
    replyOpts: PatientReplyOptions,
    senderWaId?: string,
  ): Promise<string> {
    const greeting = this.greeting(replyOpts);
    const extracted = await this.ai.extractAppointmentFromText(
      payload,
      replyOpts,
    );
    if (!extracted.dateTime) {
      return replyOpts.addressSecondPerson
        ? `${greeting}לא הצלחתי לזהות תאריך. אפשר לנסות: חנטריש, יש לך תור ב-27.5 בבית חולים X`
        : `${greeting}לא הצלחתי לזהות תאריך. אפשר לנסות: חנטריש, לאבא יש תור ב-27.5 בבית חולים X`;
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
    const resolvedTransport = textMentionsTransport(payload)
      ? await this.familyPersonas.resolveTransportFromExtraction({
          transportDriver: extracted.transportDriver,
          transportNotes: extracted.transportNotes,
          legacyTransport: extracted.transport,
        })
      : { transportUserId: null, transportNotes: '' };
    const created = await this.appointments.create({
      title,
      dateTime: extracted.dateTime,
      timeKnown: extracted.hasTime,
      location,
      notes: extracted.notes?.trim() ?? '',
      transportUserId: resolvedTransport.transportUserId ?? undefined,
      transportNotes: resolvedTransport.transportNotes,
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
    const transportNote = await this.formatTransportNote(created, replyOpts);
    const prefix = replyOpts.addressSecondPerson ? 'הוספתי לך תור' : 'הוספתי תור';
    const base = `${greeting}${prefix}: ${created.title} — ${when}, ${created.location}.${transportNote}`;

    if (!extracted.hasTime) {
      // Don't fabricate a time. Save the date now, then offer to fill the hour in.
      if (senderWaId) {
        await this.conversation.setPendingAction(senderWaId, {
          kind: 'awaitTime',
          appointmentId: created.id,
          summary: created.title,
        });
      }
      return `${base}\nלא ציינת שעה — באיזו שעה התור? (אפשר גם להשאיר ככה ולעדכן אחר כך)`;
    }
    return base;
  }

  private async handleWakeUpdate(
    payload: string,
    replyOpts: PatientReplyOptions,
    senderWaId?: string,
  ): Promise<string> {
    const greeting = this.greeting(replyOpts);
    if (looksLikeNewAppointment(payload)) {
      return this.handleWakeCreate(payload, replyOpts, senderWaId);
    }

    const extracted = await this.ai.extractAppointmentUpdateDelta(
      payload,
      replyOpts,
    );
    const lookup = await this.resolveAppointmentForUpdate(payload);
    if (lookup.status === 'ambiguous') {
      return formatAmbiguousUpdatePromptHebrew(lookup.appointments);
    }
    if (lookup.status === 'unresolved') {
      if (looksLikeNewAppointment(payload) || parseAppointmentWhenFromText(payload)) {
        return this.handleWakeCreate(payload, replyOpts, senderWaId);
      }
      return `${greeting}לא מצאתי תור לעדכון. אפשר לציין תאריך (למשל 25.5) או שם מרפאה.`;
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
      replyOpts,
    );

    const inferred = inferWakeAppointmentFields(payload);
    const patch: {
      title?: string;
      dateTime?: string;
      location?: string;
      notes?: string;
      transportUserId?: string | null;
      transportNotes?: string;
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

    if (
      extracted.transportDriver?.trim() ||
      extracted.transportNotes?.trim() ||
      extracted.transport?.trim()
    ) {
      if (textMentionsTransport(payload)) {
        const resolved =
          await this.familyPersonas.resolveTransportFromExtraction({
            transportDriver: extracted.transportDriver,
            transportNotes: extracted.transportNotes,
            legacyTransport: extracted.transport,
          });
        patch.transportUserId = resolved.transportUserId;
        patch.transportNotes = resolved.transportNotes;
      }
    }

    const shouldMergeNotes =
      reconciled.mergeNotes || looksLikeNotesUpdate(payload);
    if (shouldMergeNotes) {
      const merged = await this.ai.mergeAppointmentNotes(
        target.notes ?? '',
        payload,
        replyOpts,
      );
      if (merged && merged !== (target.notes ?? '').trim()) {
        patch.notes = merged;
      }
    }

    if (
      !patch.dateTime &&
      !patch.notes &&
      patch.transportUserId === undefined &&
      patch.transportNotes === undefined &&
      !patch.title &&
      !patch.location
    ) {
      return `${greeting}לא זיהיתי מה להוסיף. אפשר לנסות: חנטריש תעדכן שהתור ב-30.7 הוא בשעה 9:30, או תוסיף ששירי תיקח.`;
    }

    const updated = await this.appointments.update(target.id, patch);

    const showTime = timeMentionedInMessage || updated.timeKnown;
    const when = formatAppointmentWhenHebrew(updated.dateTime, showTime);
    const timeNote = showTime ? '' : ' (שעה לא צוינה)';
    const addedNotes = patch.notes && patch.notes !== target.notes;
    const addedTransport =
      patch.transportUserId !== undefined ||
      (patch.transportNotes !== undefined &&
        patch.transportNotes !== (target.transportNotes ?? ''));
    const suffixParts: string[] = [];
    if (addedTransport) {
      suffixParts.push('הסעה עודכנה');
    }
    if (addedNotes) {
      suffixParts.push('הערות עודכנו');
    }
    const suffix = suffixParts.length
      ? ` (${suffixParts.join(', ')})`
      : '';
    const prefix = replyOpts.addressSecondPerson
      ? 'עדכנתי את התור שלך'
      : 'עדכנתי תור';
    const transportLine = formatAppointmentTransportHebrew(
      {
        transportUser: updated.transportUser ?? null,
        transportNotes: (updated as any).transportNotes ?? '',
      },
      {
        addressSecondPerson: replyOpts.addressSecondPerson,
        personas: await this.familyPersonas.getPersonas(),
      },
    );
    return `${greeting}${prefix}: ${updated.title} — ${when}${timeNote}, ${updated.location}.${suffix}`;
  }

  private async formatTransportNote(
    appointment: {
      transportUser?: { name: string; gender: any | null } | null;
      transportNotes?: string | null;
    },
    replyOpts: PatientReplyOptions,
  ): Promise<string> {
    const personas = await this.familyPersonas.getPersonas();
    const line = formatAppointmentTransportHebrew(appointment, {
      addressSecondPerson: replyOpts.addressSecondPerson,
      personas,
    });
    return line ? ` 🚗 ${line}` : '';
  }

  private toMatchRow(row: any): AppointmentMatchRow {
    return {
      id: row.id,
      title: row.title,
      location: row.location,
      notes: row.notes ?? '',
      transportNotes: row.transportNotes ?? '',
      createdAt: row.createdAt ?? new Date(0),
      dateTime: row.dateTime,
      timeKnown: row.timeKnown ?? true,
    };
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
        return resolveUpdateTarget(
          payload,
          onDay.map((r) => this.toMatchRow(r)),
        );
      }
      return { status: 'unresolved' as const };
    }

    const all = await this.appointments.findAll();
    const matched = pickAppointmentForUpdate(
      payload,
      all.map((r) => this.toMatchRow(r)),
    );
    if (matched) {
      return { status: 'resolved' as const, appointment: matched };
    }

    return { status: 'unresolved' as const };
  }

  private async resolveAppointmentForCancel(payload: string) {
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
        return resolveAppointmentCandidates(
          payload,
          onDay.map((r) => this.toMatchRow(r)),
        );
      }
      return { status: 'unresolved' as const };
    }

    const all = await this.appointments.findAll();
    const result = resolveAppointmentCandidates(
      payload,
      all.map((r) => this.toMatchRow(r)),
    );
    return result;
  }

  private async handleWakeCancel(
    payload: string,
    replyOpts: PatientReplyOptions,
    hadWakeWord: boolean,
    senderWaId: string,
  ): Promise<string> {
    const greeting = this.greeting(replyOpts);
    const lookup = await this.resolveAppointmentForCancel(payload);
    if (lookup.status === 'ambiguous') {
      return formatAmbiguousCancelPromptHebrew(lookup.appointments);
    }
    if (lookup.status === 'unresolved') {
      const parsed = parseAppointmentWhenFromText(payload);
      if (parsed) {
        const onDay = await this.appointments.findOnCalendarDay(
          new Date(parsed.dateTime),
        );
        const time = extractTimeFromText(payload);
        if (time && onDay.length > 0) {
          return formatNoTimeMatchOnDayHebrew(
            time,
            onDay.map((r) => this.toMatchRow(r)),
          );
        }
        if (onDay.length === 0) {
          const when = formatAppointmentWhenHebrew(parsed.dateTime, false);
          return `${greeting}לא מצאתי תור בתאריך ${when}.`;
        }
      }
      return `${greeting}לא מצאתי תור לביטול. אפשר לציין תאריך, שעה, או סוג ביקור (למשל אונקולוג ב-5.8 בשעה 12:00).`;
    }

    const row = lookup.appointment;
    const appointmentDate = new Date(row.dateTime);
    const when = formatAppointmentWhenHebrew(appointmentDate, row.timeKnown);

    // Without an explicit wake word, confirm before deleting (DM safety guard).
    if (!hadWakeWord) {
      await this.conversation.setPendingAction(senderWaId, {
        kind: 'cancel',
        appointmentId: row.id,
        summary: `${row.title} (${when})`,
      });
      return `${greeting}האם לבטל את התור: ${row.title} — ${when}? (אפשר להשיב "כן" לאישור)`;
    }

    await this.appointments.remove(row.id);
    return `${greeting}ביטלתי תור: ${row.title} (${when}).`;
  }

  private async safeSend(target: WhatsappSendTarget, message: string) {
    try {
      await this.sendWhatsappMessage(target, message);
    } catch (err) {
      const preview =
        message.length > 80 ? `${message.slice(0, 80)}…` : message;
      this.logger.error(
        `Failed to send WhatsApp message (${target.type}, ${message.length} chars, preview="${preview}"): ${err instanceof Error ? err.message : err}`,
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
      await this.postWhatsAppMessage(individualTarget(to), {
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
      await this.postWhatsAppMessage(individualTarget(to), {
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

  async sendWhatsappMessage(
    target: WhatsappSendTarget,
    message: string,
  ): Promise<void> {
    try {
      await this.postWhatsAppMessage(target, {
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isTransientWhatsAppError(err: unknown): boolean {
    if (!axios.isAxiosError(err)) {
      return false;
    }
    const status = err.response?.status;
    const body = err.response?.data as {
      error?: { code?: number; is_transient?: boolean };
    };
    if (body?.error?.is_transient === true) {
      return true;
    }
    if (body?.error?.code === 2) {
      return true;
    }
    return status !== undefined && status >= 500;
  }

  private async postWhatsAppMessage(
    target: WhatsappSendTarget,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const token = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    if (!token || !phoneNumberId) {
      throw new ServiceUnavailableException(
        'WhatsApp is not configured on the server (missing access token or phone number id)',
      );
    }

    const base =
      target.type === 'group'
        ? {
            messaging_product: 'whatsapp',
            recipient_type: 'group',
            to: target.groupId,
          }
        : {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: target.phone.replace(/\D/g, ''),
          };

    const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
    const body = { ...base, ...payload };
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    };
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await axios.post(url, body, { headers });
        return;
      } catch (err) {
        if (attempt < maxAttempts && this.isTransientWhatsAppError(err)) {
          this.logger.warn(
            `WhatsApp send transient error (attempt ${attempt}/${maxAttempts}), retrying…`,
          );
          await this.sleep(1500 * attempt);
          continue;
        }
        throw err;
      }
    }
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
