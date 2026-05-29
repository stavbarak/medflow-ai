import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  parseReconcileUpdateResponse,
  type ReconcileUpdateResult,
} from './appointment-update-reconcile';
import { parseNotesMergeResponse } from './notes-merge';
import {
  filterMergedNotes,
  filterNotesToSourceText,
} from '../common/utils/notes-grounding';
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

  /**
   * Extract structured appointment fields from free Hebrew text. Output is validated before return.
   */
  async extractAppointmentFromText(
    text: string,
    replyOptions?: PatientReplyOptions,
  ): Promise<WakeAppointmentFields> {
    return this.extractAppointmentFields(text, 'create', replyOptions);
  }

  /** Extract only what the user wants to add or change on an existing appointment. */
  async extractAppointmentUpdateDelta(
    text: string,
    replyOptions?: PatientReplyOptions,
  ): Promise<WakeAppointmentFields> {
    return this.extractAppointmentFields(text, 'update', replyOptions);
  }

  private async extractAppointmentFields(
    text: string,
    mode: 'create' | 'update',
    replyOptions?: PatientReplyOptions,
  ): Promise<WakeAppointmentFields> {
    const openai = this.ensureClient();
    const label = patientLabelForPrompt(this.patientLabel, replyOptions);
    const personas = await this.familyPersonaSuffix();
    const systemCreate = `You extract medical appointment information from Hebrew text for ONE patient (${label}). Return JSON with optional keys: title (specific visit type — never bare "תור" if details exist), location (when mentioned), transportDriver (first name only of who drives, e.g. "שירי", "עדי"), transportNotes (extra ride details: מונית, תחזיר, pickup time — NOT the driver's name), notes, requirements (array of { description }). Do NOT include dateTime.
CRITICAL: put the driver's NAME in transportDriver, NOT in notes. Put מונית/תחזיר/return details in transportNotes.
CRITICAL for notes: copy ONLY prep facts (blood tests, fasting, what to bring). Hebrew only.${personas}`;
    const systemUpdate = `The user is adjusting an EXISTING appointment (${label}). Return JSON with optional keys:
- requirements (array of { description }) if any new checklist items
- transportDriver (first name only) if a new driver is specified — replaces previous driver
- transportNotes (string) extra ride details only (מונית, תחזיר) — replaces previous transportNotes
Do NOT include notes. Hebrew only.${personas}`;
    const completion = await openai.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: mode === 'update' ? systemUpdate : systemCreate,
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
    if (mode === 'create' && merged.notes?.trim()) {
      merged.notes = filterNotesToSourceText(merged.notes, text);
    }
    return merged;
  }

  /**
   * Decide title/location corrections and whether notes need merging.
   * Does NOT return dateTime — the server handles time only when explicitly stated.
   */
  async reconcileAppointmentUpdate(
    existing: {
      title: string;
      location: string;
      notes: string;
      dateTimeIso: string;
    },
    userMessage: string,
    replyOptions?: PatientReplyOptions,
  ): Promise<ReconcileUpdateResult> {
    const openai = this.ensureClient();
    const label = patientLabelForPrompt(this.patientLabel, replyOptions);
    const personas = await this.familyPersonaSuffix();
    const completion = await openai.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You help update ONE existing medical appointment (${label}) from a Hebrew WhatsApp message.
Return JSON only:
{
  "title": optional string — visit type if user names/corrects it (e.g. ביקורת קרדיו אונקולוגיה),
  "location": optional string — hospital/clinic if user names/corrects it,
  "mergeNotes": boolean — true if message adds prep, meals, or what to bring; false if ONLY time/title/location
}
Rules:
- If user clarifies what the appointment IS (ביקורת…, פט סיטי…), set title even if existing title was generic "תור".
- If user names a place (איכילוב…), set location even if existing was "ייקבע".
- Never output bare "תור" or "ייקבע" as improvements.
- Do NOT output dateTime or notes text here.${personas}`,
        },
        {
          role: 'user',
          content: `EXISTING:\ntitle: ${existing.title}\nlocation: ${existing.location}\ndateTime: ${existing.dateTimeIso}\nnotes: ${existing.notes || '(ריק)'}\n\nMESSAGE:\n${userMessage}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return { mergeNotes: false };
    }
    try {
      return parseReconcileUpdateResponse(JSON.parse(raw) as unknown);
    } catch {
      return { mergeNotes: false };
    }
  }

  /**
   * Merge existing appointment notes with a new WhatsApp message (prep / what to bring — not transport).
   */
  async mergeAppointmentNotes(
    existingNotes: string,
    userMessage: string,
    replyOptions?: PatientReplyOptions,
  ): Promise<string | null> {
    const openai = this.ensureClient();
    const label = patientLabelForPrompt(this.patientLabel, replyOptions);
    const personas = await this.familyPersonaSuffix();
    const existing = existingNotes.trim();
    const completion = await openai.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You maintain Hebrew "notes" for one medical appointment (${label}) — preparation, what to bring, meals, reminders. NOT transport (who drives).
Return JSON: { "notes": "..." } — the full updated notes text.

Rules:
- If the new message adds an UNRELATED fact (meal time, what to bring, parking, blood test reminder), APPEND it as a new sentence/line.
- Keep all other existing facts that were not contradicted.
- Do NOT put ride/driver/pickup info here — that lives in a separate transport field.
- Do not invent facts not in existing notes or the new message.
- Short, natural Hebrew suitable for a family coordination app.
- If the new message has nothing for notes, return { "notes": "<unchanged existing>" }.${personas}`,
        },
        {
          role: 'user',
          content: `EXISTING_NOTES:\n${existing || '(ריק)'}\n\nNEW_MESSAGE:\n${userMessage}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return null;
    }
    try {
      const merged = parseNotesMergeResponse(JSON.parse(raw) as unknown);
      if (!merged) {
        return null;
      }
      return filterMergedNotes(existing, merged, userMessage);
    } catch {
      return null;
    }
  }

  /**
   * Turn grounded facts JSON into a short Hebrew reply. Model must not invent facts.
   */
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
          content: `You are a warm, natural, ChatGPT-like Hebrew assistant for a family medical-appointments app.
Answer in Hebrew. Speak like a helpful person, not a form.

Single patient:
- This assistant manages exactly ONE patient: ${this.patientLabel}. Every appointment in FACTS belongs to that patient.

Typo tolerance (a basic LLM should infer meaning from messy input — so must you):
- The question is natural human text and may contain spelling mistakes, missing/extra letters, or phonetic spellings. Infer the intended meaning the way a fluent Hebrew speaker would — for the patient's name, treatment/test names (e.g. פט סיטי, קיטרודה, זומרה), locations (e.g. איכילוב, שיבא), and dates. Match against FACTS by closest intended meaning, not exact characters.
- If a person name looks like a typo/variant of the patient's name (e.g. "אסא" vs "אבא"), assume it refers to the patient and answer normally — but acknowledge it briefly first, e.g. "מניח שהתכוונת לאבא — ..." so the user can correct you if wrong.
- Apply the same light acknowledgment for other clear typos when it changes the match (e.g. "מניח שהתכוונת לפט סיטי — ..."), but don't over-explain trivial corrections.
- Only ask a clarifying question when the input is genuinely ambiguous (a truly unfamiliar name with no close match). Never invent a mixed/incorrect answer.

Grounding:
- For anything about appointments, schedules, prep, transport, counts, requirements, or a treatment/test — answer ONLY from FACTS. Do not invent appointments, locations, times, transport, or requirements that are not in FACTS.
- A question like "what to know before the Zomera infusion" must be answered from the stored notes/requirements for that appointment — NOT generic medical advice.
- Only if the question is clearly unrelated to the calendar (jokes, weather, general trivia) AND FACTS has nothing relevant, you may answer briefly from general knowledge — without inventing appointments, and without medical diagnosis/treatment instructions (suggest consulting a clinician for medical specifics).

Critical accuracy rule:
- If you mention an appointment’s time/date or location, copy the exact fields from FACTS ("whenHebrew", "dateTime", "location", "title"). Do not guess or rewrite them.

Language (very important):
- Respond ONLY in Hebrew characters. Never include Spanish, English, or any other non-Hebrew words. Do not mix languages.
- The only allowed non-Hebrew tokens are established medical/proper-noun abbreviations that have no Hebrew form (e.g. PET, CT, MRI, IV).

Timeframe defaulting:
- FACTS may include upcomingAppointments and (when relevant) recentPastAppointments.
- If the question does NOT explicitly ask about the past ("עד היום", "עד כה", "היה", "כבר", "בעבר", "מה היה", "כמה היו"), assume the future and use upcomingAppointments.
- Only use recentPastAppointments when the question clearly asks about past/history.

Counting rules:
- "כמה ... כבר היו" / "עד היום" / "עד כה" → count only past items (dateTime < now); use FACTS.stats "*PastCount" if present.
- "כמה עוד יהיו" / "כמה יש בעתיד" → use upcoming counts.
- Combined question → you may state both past and upcoming.

If the question says "כל התורים" but FACTS has a scope/limit (FACTS.scope), answer based on what you have (e.g. "לפי התורים הקרובים שבמערכת...").
If the answer is missing from FACTS, say briefly what's missing and what the user can add.

Style:
- Natural, flowing Hebrew; direct answer first, then 0–3 short bullets only if helpful.${addressHint ? `\n${addressHint}` : ''}${persona}${personas}`,
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
