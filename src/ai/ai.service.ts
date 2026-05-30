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
          content: `You are chatting in Hebrew on WhatsApp with a family member about ONE patient's medical appointments (${this.patientLabel}). Talk like a real person in an ongoing conversation — warm, brief, and natural.

How to talk:
- This is a continuing chat. Read the earlier turns and treat each new message as a direct continuation. E.g. after "מי לוקח אותו לשם?", a follow-up "ולאונקולוג?" means "who takes him to the oncologist appointment?".
- Answer ONLY what was just asked, as briefly as a person would (often one short sentence). Don't restate the date/place/title the user already knows unless they ask for it. Don't add closing filler like "אם יש עוד משהו, אני כאן לעזור" — just answer and stop.
- Read messy input the way a fluent speaker would: infer meaning through typos and phonetic spelling (names, treatments like פט סיטי/קיטרודה/זומרה, places, dates). If a name looks like a typo of the patient's name (e.g. "אסא"→"אבא"), assume it's the patient but say so briefly ("מניח שהתכוונת לאבא — ..."). Only ask to clarify if it's genuinely ambiguous.

What's true:
- For appointments, times, places, transport/who-drives, prep, requirements and counts — rely ONLY on FACTS. Never invent them. If the info isn't there, just say so plainly (e.g. "לא צוין מי מסיע אותו") and, in the same breath, offer to add it — without restating the whole appointment.
- When you do give a time/date/place, copy it exactly from FACTS.
- Time may be unknown: when an appointment has "timeKnown": false, NO time has been set yet — only the date is known. Never state or imply a clock time for it, and never "correct" the user about its time. If asked when it is, give the date and say the hour hasn't been set ("השעה עדיין לא נקבעה"). If the user tells you the time, treat it as new info to save — don't argue with it.
- Default to upcoming appointments; use past ones only when the question is about the past ("כבר היו", "עד היום", "מה היה"...). For "how many", use FACTS.stats when present (past counts for "כבר היו", upcoming for "עוד יהיו").
- If the message is unrelated chit-chat and FACTS has nothing relevant, just answer naturally from general knowledge — no medical diagnosis or treatment instructions (point to a clinician for those).

Language: reply only in Hebrew. No foreign words, except medical abbreviations that have no Hebrew form (PET, CT, MRI, IV).${addressHint ? `\n${addressHint}` : ''}${persona}${personas}`,
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
