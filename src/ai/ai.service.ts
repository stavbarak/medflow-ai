import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  parseReconcileUpdateResponse,
  type ReconcileUpdateResult,
} from './appointment-update-reconcile';
import {
  filterMergedNotes,
  filterNotesToSourceText,
} from '../common/utils/notes-grounding';
import { parseNotesMergeResponse } from './notes-merge';
import {
  mergeWakeAppointmentExtraction,
  type WakeAppointmentFields,
} from './wake-appointment';

@Injectable()
export class AiService {
  private readonly client: OpenAI | null;
  private readonly model: string;
  /** Single-patient context for prompts (Hebrew). */
  private readonly patientLabel: string;

  constructor(private readonly config: ConfigService) {
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

  /**
   * Extract structured appointment fields from free Hebrew text. Output is validated before return.
   */
  async extractAppointmentFromText(text: string): Promise<WakeAppointmentFields> {
    return this.extractAppointmentFields(text, 'create');
  }

  /** Extract only what the user wants to add or change on an existing appointment. */
  async extractAppointmentUpdateDelta(
    text: string,
  ): Promise<WakeAppointmentFields> {
    return this.extractAppointmentFields(text, 'update');
  }

  private async extractAppointmentFields(
    text: string,
    mode: 'create' | 'update',
  ): Promise<WakeAppointmentFields> {
    const openai = this.ensureClient();
    const systemCreate = `You extract medical appointment information from Hebrew text for ONE patient (${this.patientLabel}). Return JSON with optional keys: title (specific visit type — never bare "תור" if details exist), location (when mentioned), notes, requirements (array of { description }). Do NOT include dateTime.
CRITICAL for notes: copy ONLY facts the user actually wrote (prep, blood tests, email instructions, companions, transport IF they said it). NEVER invent transportation (מונית, רכב, מכונית פרטית, הגעה) or people not named in the message. Hebrew only.`;
    const systemUpdate = `The user is adjusting an EXISTING appointment (${this.patientLabel}). Return JSON with ONLY new requirements if any (array of { description }). Do NOT include notes. Hebrew only.`;
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
  ): Promise<ReconcileUpdateResult> {
    const openai = this.ensureClient();
    const completion = await openai.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You help update ONE existing medical appointment (${this.patientLabel}) from a Hebrew WhatsApp message.
Return JSON only:
{
  "title": optional string — visit type if user names/corrects it (e.g. ביקורת קרדיו אונקולוגיה),
  "location": optional string — hospital/clinic if user names/corrects it,
  "mergeNotes": boolean — true if message adds/changes companions, transport, meals, or prep notes; false if ONLY time/title/location
}
Rules:
- If user clarifies what the appointment IS (ביקורת…, פט סיטי…), set title even if existing title was generic "תור".
- If user names a place (איכילוב…), set location even if existing was "ייקבע".
- Never output bare "תור" or "ייקבע" as improvements.
- Do NOT output dateTime or notes text here.`,
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
   * Merge existing appointment notes with a new WhatsApp message.
   * Overrides the same topic (e.g. who drives); appends unrelated facts.
   */
  async mergeAppointmentNotes(
    existingNotes: string,
    userMessage: string,
  ): Promise<string | null> {
    const openai = this.ensureClient();
    const existing = existingNotes.trim();
    const completion = await openai.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You maintain Hebrew "notes" for one medical appointment (${this.patientLabel}).
Return JSON: { "notes": "..." } — the full updated notes text.

Rules:
- If the new message CORRECTS or REPLACES the same topic (who drives, who accompanies, how they arrive, pickup/return), UPDATE that part and remove the outdated sentence. Example: existing "עדי תלווה" + new "שירי תיקח" → keep only Shiri for transport, not both.
- If the new message adds an UNRELATED fact (meal time, what to bring, parking, blood test reminder), APPEND it as a new sentence/line.
- Keep all other existing facts that were not contradicted.
- Do not invent facts not in existing notes or the new message. NEVER add transportation unless the new message mentions it.
- Short, natural Hebrew suitable for a family coordination app.
- If the new message has nothing for notes, return { "notes": "<unchanged existing>" }.`,
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
  async answerQuestionFromFacts(question: string, factsJson: string) {
    const openai = this.ensureClient();
    const completion = await openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You answer questions in Hebrew only. Use ONLY the facts JSON in FACTS (including appointment notes for transport, companions, and preparation). If the answer is not in the facts, say briefly in Hebrew that it is not stored. Be concise, suitable for WhatsApp.`,
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
