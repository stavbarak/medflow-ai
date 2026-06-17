import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { parseAppointmentUpdateResponse } from './appointment-update';
import { filterNotesToSourceText } from '../common/utils/notes-grounding';
import {
  mergeWakeAppointmentExtraction,
  type WakeAppointmentFields,
} from './wake-appointment';
import {
  type PatientReplyOptions,
  patientAnswerInstruction,
  patientLabelForPrompt,
  senderPersonaInstruction,
} from '../common/utils/patient-address';
import type { ConversationTurnDto } from '../conversation/conversation.service';
import { FamilyPersonaService } from '../phone-allowlist/family-persona.service';

@Injectable()
export class AiService {
  private readonly client: OpenAI | null;
  private readonly model: string;
  /** Single-patient context for prompts (Hebrew). */
  private readonly patientLabel: string;

  constructor(
    private readonly config: ConfigService,
    private readonly familyPersonas: FamilyPersonaService,
  ) {
    const key = this.config.get<string>('OPENAI_API_KEY');
    const baseURL = this.config.get<string>('OPENAI_BASE_URL');
    this.model = this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
    this.patientLabel =
      this.config.get<string>('PATIENT_NAME')?.trim() || 'אבא (מטופל יחיד)';
    this.client = key
      ? new OpenAI({
          apiKey: key,
          baseURL: baseURL || undefined,
          timeout: 30_000,
          maxRetries: 2,
        })
      : null;
  }

  private ensureClient(): OpenAI {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'שירות בינה מלאכותית לא זמין (חסר מפתח API)',
      );
    }
    return this.client;
  }

  private async familyPersonaSuffix(): Promise<string> {
    const block = await this.familyPersonas.getPromptBlock();
    return block ? `\n\n${block}` : '';
  }

  async extractAppointmentFromText(
    text: string,
    replyOptions?: PatientReplyOptions,
  ): Promise<WakeAppointmentFields> {
    const openai = this.ensureClient();
    const label = patientLabelForPrompt(this.patientLabel, replyOptions);
    const personas = await this.familyPersonaSuffix();
    const completion = await openai.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You extract medical appointment information from Hebrew text for ONE patient (${label}). Return JSON with optional keys: title (specific visit type — never bare "תור" if details exist), location (when mentioned — use "טלפוני" for phone visits), transportDriver (first name only of who drives), transportNotes (ride details like מונית — NOT the driver's name), notes (prep, fasting, what to bring). Do NOT include dateTime.
Put the driver's NAME in transportDriver, NOT in notes. If the visit is telephonic or no ride is needed, leave transportDriver and transportNotes empty. Hebrew only.${personas}`,
        },
        { role: 'user', content: text },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new ServiceUnavailableException('לא התקבלה תשובה מהמודל');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new ServiceUnavailableException('פלט המודל אינו JSON תקין');
    }
    const merged = mergeWakeAppointmentExtraction(parsed, text);
    if (merged.notes?.trim()) {
      merged.notes = filterNotesToSourceText(merged.notes, text);
    }
    return merged;
  }

  /** One pass: read the message in context and return only fields to change. */
  async parseAppointmentUpdate(
    existing: {
      title: string;
      location: string;
      notes: string;
      dateTimeIso: string;
      transportDriver: string | null;
      transportNotes: string;
    },
    userMessage: string,
    replyOptions?: PatientReplyOptions,
  ) {
    const openai = this.ensureClient();
    const label = patientLabelForPrompt(this.patientLabel, replyOptions);
    const personas = await this.familyPersonaSuffix();
    const completion = await openai.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You interpret a Hebrew WhatsApp message about ONE existing medical appointment (${label}). Return JSON with ONLY fields the user wants to change:

{
  "title": optional string,
  "location": optional string — clinic/hospital, or "טלפוני" for phone visits,
  "notes": optional string — full updated prep/notes if the message adds or changes them,
  "transportDriver": optional string | null — driver first name; null to remove driver,
  "transportNotes": optional string | null — ride details; null to clear
}

Read natural Hebrew including negation and visit type:
- "טלפוני", "שיחה", "זום" → set location accordingly and clear transport unless a driver is explicitly named
- "אין צורך בהסעה", "בלי הסעה", "לא צריך נהג" → transportDriver: null, transportNotes: null
- Only include keys the message actually changes; omit unchanged fields
- Do NOT output dateTime (the server handles schedule separately)
- Hebrew only${personas}`,
        },
        {
          role: 'user',
          content: `EXISTING:\ntitle: ${existing.title}\nlocation: ${existing.location}\ndateTime: ${existing.dateTimeIso}\nnotes: ${existing.notes || '(ריק)'}\ntransportDriver: ${existing.transportDriver || '(אין)'}\ntransportNotes: ${existing.transportNotes || '(ריק)'}\n\nMESSAGE:\n${userMessage}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return {};
    }
    try {
      return parseAppointmentUpdateResponse(JSON.parse(raw) as unknown);
    } catch {
      return {};
    }
  }

  async answerQuestionFromFacts(
    question: string,
    factsJson: string,
    replyOptions?: PatientReplyOptions,
    history?: ConversationTurnDto[],
  ) {
    const openai = this.ensureClient();
    const addressHint = patientAnswerInstruction(replyOptions);
    const persona = senderPersonaInstruction(replyOptions);
    const personas = await this.familyPersonaSuffix();
    const completion = await openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are chatting in Hebrew on WhatsApp with a family member about ONE patient's medical appointments (${this.patientLabel}). Talk like a real person in an ongoing conversation — warm, brief, and natural.

How to talk:
- This is a continuing chat. Read the earlier turns and treat each new message as a direct continuation.
- Answer ONLY what was just asked, as briefly as a person would (often one short sentence). Don't restate the date/place/title the user already knows unless they ask for it. Don't add closing filler.
- Read messy input the way a fluent speaker would: infer meaning through typos and phonetic spelling.

What's true:
- For appointments, times, places, transport, prep and counts — rely ONLY on FACTS. Never invent them.
- When you give a time/date/place, copy it exactly from FACTS.
- Time may be unknown: when "timeKnown": false, only the date is known — never state a clock time.
- FACTS.usefulContacts holds saved numbers; give them exactly as stored when asked.
- Default to upcoming appointments; use past when the question is about history or counts.
- If the message is unrelated chit-chat, answer naturally — no medical diagnosis (point to a clinician for those).

Language: reply only in Hebrew. No foreign words except medical abbreviations without Hebrew (PET, CT, MRI, IV).${addressHint ? `\n${addressHint}` : ''}${persona}${personas}`,
        },
        ...this.historyMessages(history),
        {
          role: 'user',
          content: `FACTS:\n${factsJson}\n\nשאלה:\n${question}`,
        },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return 'לא הצלחתי להבין. נסו לנסח שוב.';
    }
    return text;
  }

  private historyMessages(
    history?: ConversationTurnDto[],
  ): { role: 'user' | 'assistant'; content: string }[] {
    if (!history?.length) {
      return [];
    }
    return history
      .filter((t) => t.text.trim())
      .map((t) => ({ role: t.role, content: t.text }));
  }
}
