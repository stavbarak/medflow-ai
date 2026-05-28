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
} from '../common/utils/patient-address';
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
  ) {
    const openai = this.ensureClient();
    const addressHint = patientAnswerInstruction(replyOptions);
    const personas = await this.familyPersonaSuffix();
    const completion = await openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are a friendly and helpful Hebrew assistant for a family medical-appointments app.
Answer in Hebrew only.

You may ONLY use the facts JSON in FACTS. Do not invent appointments, locations, times, transport, or requirements that are not present in FACTS.

Be ChatGPT-like: natural, confident, and helpful. It is OK (and encouraged) to compute simple derived answers from the facts, for example:
- counting items (כמה תורים? כמה עם מונית?)
- yes/no based on facts
- listing which appointments match a condition

If you don't know the answer, apologize and offer to help the user add the information.
If you don't understand the question, apologize and ask the user to rephrase it. Offer help with rephrasing in a way you understand. Let them know you're here to help.

If the question says "כל התורים" / "האם לכל התורים..." but FACTS has a scope/limit (see FACTS.scope), answer explicitly based on the facts you have (e.g. "לפי 15 התורים הקרובים שמופיעים במערכת...").

When information is missing, say what is missing and how to phrase/store it (e.g. "אין מידע על מונית" / "לא הוגדרה הסעה לתור X"). 

Prefer short WhatsApp-friendly answers:
- 1–3 sentences, and if needed add a short bullet list.
${addressHint ? ` ${addressHint}` : ''}${personas}`,
        },
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
}
